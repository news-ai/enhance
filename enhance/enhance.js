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
var express = require('express');
var bodyParser = require('body-parser')

// Instantiate a elasticsearch client
var client = new elasticsearch.Client({
    host: 'https://newsai:XkJRNRx2EGCd6@search1.newsai.org',
    // log: 'trace',
    rejectUnauthorized: false
});

var FullContact = require('fullcontact');
var fullcontact = FullContact.createClient('5686291ee0c6c944');

// Instantiate a sentry client
var sentryClient = new raven.Client('https://475ea5ee391b4ee797eb40e9ee7cad62:780b0e5e8f9341daa240aec8ad6f495a@sentry.io/121869');
sentryClient.patchGlobal();

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

function searchEmailInES(email) {
    var deferred = Q.defer();

    client.get({
        index: 'database',
        type: 'contacts',
        id: email
    }, function(error, response) {
        if (error) {
            sentryClient.captureMessage(error);
            deferred.reject(error);
        } else {
            deferred.resolve(response);
        }
    });

    return deferred.promise;
}

function addEmailToES(email, fullContactData) {
    var deferred = Q.defer();

    var esActions = [];
    var indexRecord = {
        index: {
            _index: 'database',
            _type: 'contacts',
            _id: email
        }
    };
    var dataRecord = fullContactData;

    esActions.push(indexRecord);
    esActions.push({
        data: dataRecord
    });

    client.bulk({
        body: esActions
    }, function(error, response) {
        if (error) {
            console.error(error);
            sentryClient.captureMessage(error);
            deferred.resolve(false);
        }
        deferred.resolve(true);
    });

    return deferred.promise;
}

app.get('/fullcontactCallback', function(req, res) {
    res.send('No ID present.');
});

app.get('/fullcontact/:email', function(req, res) {
    var email = req.params.email;
    email = email.toLowerCase();

    if (email !== '') {
        searchEmailInES(email).then(function(returnData) {
            // If email is in ES already then we resolve it
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(returnData._source.data));
        }, function(err) {
            // If email is not in ES then we look it up
            fullcontact.person.email(email, function(err, returnData) {
                if (err) {
                    // If FullContact has no data on the email
                    console.error(err);
                    sentryClient.captureMessage(err);
                    res.send(err);
                    return
                }

                if (returnData.status === 200) {
                    addEmailToES(email, returnData).then(function(status) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify(returnData));
                        return
                    }, function(error) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify(error));
                        return
                    });
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify(returnData));
                    return
                }
            });
        });
    } else {
        res.send('Missing email');
        return;
    }
});

app.listen(8080, function() {
    console.log('Enhance app listening on port 8080!');
});