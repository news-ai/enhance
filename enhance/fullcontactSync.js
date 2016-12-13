'use strict';

var Fullcontact = require('fullcontact');
var moment = require('moment');
var rp = require('request-promise');
var elasticsearch = require('elasticsearch');
var Q = require('q');
var raven = require('raven');
var gcloud = require('google-cloud')({
    projectId: 'newsai-1166'
});

// Instantiate a elasticsearch client
var client = new elasticsearch.Client({
    host: 'https://newsai:XkJRNRx2EGCd6@search1.newsai.org',
    // log: 'trace',
    rejectUnauthorized: false
});

var FullContact = require('fullcontact');
var fullcontact = FullContact.createClient('5686291ee0c6c944');

// Initialize Google Cloud
var topicName = 'process-enhance';
var subscriptionName = 'node-enhance';
var pubsub = gcloud.pubsub();

// Instantiate a sentry client
var sentryClient = new raven.Client('https://475ea5ee391b4ee797eb40e9ee7cad62:780b0e5e8f9341daa240aec8ad6f495a@sentry.io/121869');
sentryClient.patchGlobal();

// Get a Google Cloud topic
function getTopic(cb) {
    pubsub.createTopic(topicName, function(err, topic) {
        // topic already exists.
        if (err && err.code === 409) {
            return cb(null, pubsub.topic(topicName));
        }
        return cb(err, topic);
    });
}

function enhanceContact(data) {
    var deferred = Q.defer();

    fullcontact.person.email(data.email, function (err, returnData) {
        if (err) {
            console.error(err);
            sentryClient.captureMessage(err);
            deferred.resolve(err);
            return;
        } else {

        }
    });

    return deferred.promise;
}

function subscribe(cb) {
    var subscription;

    // Event handlers
    function handleMessage(message) {
        cb(null, message);
    }

    function handleError(err) {
        console.error(err);
        sentryClient.captureMessage(err);
    }

    getTopic(function(err, topic) {
        if (err) {
            sentryClient.captureMessage(err);
            return cb(err);
        }

        topic.subscribe(subscriptionName, {
            autoAck: true,
            reuseExisting: true
        }, function(err, sub) {
            if (err) {
                return cb(err);
            }

            subscription = sub;

            // Listen to and handle message and error events
            subscription.on('message', handleMessage);
            subscription.on('error', handleError);

            console.log('Listening to ' + topicName +
                ' with subscription ' + subscriptionName);
        });
    });

    // Subscription cancellation function
    return function() {
        if (subscription) {
            // Remove event listeners
            subscription.removeListener('message', handleMessage);
            subscription.removeListener('error', handleError);
            subscription = undefined;
        }
    };
}

subscribe(function(err, message) {
    // Any errors received are considered fatal.
    if (err) {
        console.error(err);
        sentryClient.captureMessage(err);
        throw err;
    }
    console.log('Received request to enhance email ' + message.data.email);
    enhanceContact(message.data)
        .then(function(status) {
            rp('https://hchk.io/fadd27af-0555-433d-8b5c-09c544ac1c16')
                .then(function(htmlString) {
                    console.log('Completed execution for ' + message.data.email);
                })
                .catch(function(err) {
                    console.error(err);
                });
        }, function(error) {
            console.error(error);
            sentryClient.captureMessage(error);
        });
});

var message = {
    data: {
        'email': 'me@abhiagarwal.com'
    }
}

enhanceContact(message.data)
    .then(function(status) {
        rp('https://hchk.io/fadd27af-0555-433d-8b5c-09c544ac1c16')
            .then(function (htmlString) {
                console.log('Completed execution for ' + message.data.email);
            })
            .catch(function (err) {
                console.error(err);
            });
    }, function(error) {
        console.error(error);
        sentryClient.captureMessage(error);
    });
