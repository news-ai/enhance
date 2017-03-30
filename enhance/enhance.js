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
var bodyParser = require('body-parser');

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

function searchEmailInES(email, typeName) {
    var deferred = Q.defer();

    client.get({
        index: 'database',
        type: typeName,
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

function addContactMetadataToES(email, organizations) {
    var deferred = Q.defer();

    var esActions = [];

    for (var i = 0; i < organizations.length; i++) {
        var indexRecord = {
            index: {
                _index: 'database',
                _type: 'metadata1',
                _id: organizations[i]._id
            }
        };

        delete organizations[i]['_id']

        var dataRecord = organizations[i];
        esActions.push(indexRecord);
        esActions.push({
            data: dataRecord
        });
    }

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

function addEmailToES(email, fullContactData, typeName) {
    var deferred = Q.defer();

    var esActions = [];
    var indexRecord = {
        index: {
            _index: 'database',
            _type: typeName,
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

function addContactOrganizationsToES(email, organizations) {
    var organizationObjects = [];

    for (var i = 0; i < organizations.length; i++) {
        if (organizations[i].name && organizations[i].name !== '') {
            // Publication => Email
            // Position => Email
            var organizationNameWithoutSpecial = organizations[i].name.replace(/[^a-zA-Z ]/g, "");
            organizationNameWithoutSpecial = organizationNameWithoutSpecial.replace(/[\u00A0\u1680​\u180e\u2000-\u2009\u200a​\u200b​\u202f\u205f​\u3000]/g,'')
            organizationNameWithoutSpecial = organizationNameWithoutSpecial.toLowerCase();
            organizationNameWithoutSpecial = organizationNameWithoutSpecial.split(' ').join('-');
            var objectIndexName = email + '-' + organizationNameWithoutSpecial;

            var indexObject = {
                '_id': objectIndexName,
                'email': email,
                'organizationName': organizations[i].name,
                'title': organizations[i].title || '',
                'current': organizations[i].current || false
            };

            organizationObjects.push(indexObject);
        }
    }

    return organizationObjects;
}

app.post('/fullcontactCallback', function(req, res) {
    var data = req.body;
    var email = data.email;

    searchEmailInES(email, 'contacts').then(function(returnData) {
        // If email is in ES already then we resolve it
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(returnData._source));
        return;
    }, function(err) {
        if (returnData.status === 200) {
            addEmailToES(email, data, 'contacts').then(function(status) {
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({
                    data: data
                }));
                return;
            }, function(error) {
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({
                    data: error
                }));
                return;
            });
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({
                data: data
            }));
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
                    res.send(JSON.stringify({
                        data: err
                    }));
                    return;
                }

                if (returnData.status === 200) {
                    addCompanyToES(url, returnData).then(function(status) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({
                            data: returnData
                        }));
                        return;
                    }, function(error) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({
                            data: error
                        }));
                        return;
                    });
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({
                        data: returnData
                    }));
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
        searchEmailInES(email, 'contacts').then(function(returnData) {
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
                    res.send(JSON.stringify({
                        data: err
                    }));
                    return;
                }

                if (returnData.status === 200) {
                    var organizations = [];
                    if (returnData && returnData.organizations) {
                        var organizations = addContactOrganizationsToES(email, returnData.organizations);
                    }
                    addEmailToES(email, returnData, 'contacts').then(function(status) {
                        addContactMetadataToES(email, organizations).then(function(status) {
                            res.setHeader('Content-Type', 'application/json');
                            res.send(JSON.stringify({
                                data: returnData
                            }));
                            return;
                        }, function (error) {
                            // Return data not error. Doesn't matter if we fail to add metadata
                            res.setHeader('Content-Type', 'application/json');
                            res.send(JSON.stringify({
                                data: returnData
                            }));
                            return;
                        })
                    }, function(error) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({
                            data: error
                        }));
                        return;
                    });
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({
                        data: returnData
                    }));
                    return;
                }
            });
        });
    } else {
        res.send('Missing email');
        return;
    }
});

app.get('/twitter/:email/:twitteruser', function(req, res) {
    var twitterUser = req.params.twitteruser;
    var email = req.params.email;
    twitterUser = twitterUser.toLowerCase();
    email = email.toLowerCase();

    if (email !== '' || twitterUser !== '') {
        searchEmailInES(email, 'twitters').then(function(returnData) {
            // If email is in ES already then we resolve it
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(returnData._source));
            return;
        }, function(err) {
            // If email is not in ES then we look it up
            fullcontact.person.twitter(twitterUser, function(err, returnData) {
                if (err) {
                    // If FullContact has no data on the email
                    sentryClient.captureMessage(err);
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({
                        data: err
                    }));
                    return;
                }

                if (returnData.status === 200) {
                    addEmailToES(email, returnData, 'twitters').then(function(status) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({
                            data: returnData
                        }));
                        return;
                    }, function(error) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({
                            data: error
                        }));
                        return;
                    });
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({
                        data: returnData
                    }));
                    return;
                }
            });
        });
    } else {
        res.send('Missing email or twitter username');
        return;
    }
});

app.get('/lookup/email/:email', function(req, res) {
    var email = req.params.email;
    email = email.toLowerCase();

    searchEmailInES(email, 'contacts').then(function(returnData) {
        // If email is in ES already then we resolve it
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(returnData._source));
        return;
    }, function(error) {
        searchEmailInES(email, 'twitters').then(function(returnData) {
            // If email is in ES already then we resolve it
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(returnData._source));
            return;
        }, function(error) {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({
                data: error
            }));
            return;
        });
    });
});

app.get('/lookup/query', function(req, res) {

});

app.get('/location/:location', function(req, res) {
    var location = req.params.location;
    location = location.toLowerCase();

    if (location !== '') {
        fullcontact.location.normalize(location, function(err, data) {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({
                data: data
            }));
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