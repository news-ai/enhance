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

function searchCompanyInES(company) {
    var deferred = Q.defer();

    client.get({
        index: 'database',
        type: 'companies',
        id: company
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

function addCompanyToES(company, fullContactData) {
    var deferred = Q.defer();

    var esActions = [];
    var indexRecord = {
        index: {
            _index: 'database',
            _type: 'companies',
            _id: company
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

app.post('/fullcontactCallback', function(req, res) {
    var data = req.body;
    var email = data.email;

    searchEmailInES(email).then(function(returnData) {
        // If email is in ES already then we resolve it
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(returnData._source));
        return;
    }, function(err) {
        if (returnData.status === 200) {
            addEmailToES(email, data).then(function(status) {
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({data: data}));
                return;
            }, function(error) {
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({data: error}));
                return;
            });
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({data: data}));
            return;
        }
    });
});

app.get('/company/:url', function(req, res) {
    var url = req.params.url;
    url = url.toLowerCase();

    if (url !== '') {
        searchCompanyInES(url).then(function(returnData) {
            // If url is in ES already then we resolve it
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(returnData._source));
            return;
        }, function(err) {
            // If url is not in ES then we look it up
            fullcontact.company.domain(url, function(err, returnData) {
                if (err) {
                    // If FullContact has no data on the url
                    sentryClient.captureMessage(err);
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({data: err}));
                    return;
                }

                if (returnData.status === 200) {
                    addCompanyToES(url, returnData).then(function(status) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({data: returnData}));
                        return;
                    }, function(error) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({data: error}));
                        return;
                    });
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({data: returnData}));
                    return;
                }
            });
        });
    } else {
        res.send('Missing email');
        return;
    }
});

app.get('/fullcontact/:email', function(req, res) {
    var email = req.params.email;
    email = email.toLowerCase();

    if (email !== '') {
        searchEmailInES(email).then(function(returnData) {
            // If email is in ES already then we resolve it
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(returnData._source));
            return;
        }, function(err) {
            // If email is not in ES then we look it up
            fullcontact.person.email(email, function(err, returnData) {
                if (err) {
                    // If FullContact has no data on the email
                    sentryClient.captureMessage(err);
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({data: err}));
                    return;
                }

                if (returnData.status === 200) {
                    addEmailToES(email, returnData).then(function(status) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({data: returnData}));
                        return;
                    }, function(error) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({data: error}));
                        return;
                    });
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({data: returnData}));
                    return;
                }
            });
        });
    } else {
        res.send('Missing email');
        return;
    }
});

app.get('/location/:location', function(req, res) {
    var location = req.params.location;
    location = location.toLowerCase();

    if (location !== '') {
        fullcontact.location.normalize(location, function (err, data) {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({data: data}));
            return;
        });
    } else {
        res.send('Missing location');
        return;
    }
});

app.listen(8080, function() {
    console.log('Enhance app listening on port 8080!');
});