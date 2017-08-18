'use strict';

// Internal libraries
var utils = require("./utils.js");

// Node libraries
var crypto = require('crypto');
var http = require('http');

// External libraries
var Fullcontact = require('fullcontact');
var elasticsearch = require('elasticsearch');
var Q = require('q');
var moment = require('moment');
var raven = require('raven');
var express = require('express');
var bodyParser = require('body-parser');

// Instantiate a Sentry client
var sentryClient = new raven.Client('https://475ea5ee391b4ee797eb40e9ee7cad62:780b0e5e8f9341daa240aec8ad6f495a@sentry.io/121869');
sentryClient.patchGlobal();

// Instantiate a FullContact client
var fullcontact = Fullcontact.createClient('5686291ee0c6c944');
var fullcontactVerify = Fullcontact.createClient('d5bb0047f114b740');

// Moz API
var mozAccessId = 'mozscape-677f1491a0';
var mozSecretKey = 'ad90f1947eab77585e3ac9bdf210afea';

// Instantiate a elasticsearch client
var client = new elasticsearch.Client({
    host: 'https://newsai:XkJRNRx2EGCd6@search.newsai.org',
    // log: 'trace',
    rejectUnauthorized: false
});

// Instantiate an Express client
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

function addFullContactProfileToEs(email, returnData) {
    var deferred = Q.defer();

    var organizations = [];
    if (returnData && returnData.organizations) {
        var organizations = utils.addContactOrganizationsToES(email, returnData.organizations);
    }

    utils.addResourceToES(email, returnData, 'database', 'contacts').then(function(status) {
        utils.addContactMetadataToES(organizations, 'database', 'metadata1').then(function(status) {
            returnData.email = email;
            deferred.resolve(returnData);
            return;
        }, function(error) {
            // Return data not error. Doesn't matter if we fail to add metadata
            returnData.email = email;
            sentryClient.captureMessage(error);
            deferred.resolve(returnData);
            return;
        });
    }, function(error) {
        sentryClient.captureMessage(error);
        deferred.resolve(error);
        return;
    });

    return deferred.promise;
}

function getFullContactProfile(email) {
    var deferred = Q.defer();

    fullcontact.person.email(email, function(err, returnData) {
        if (err) {
            // If FullContact has no data on the email
            sentryClient.captureMessage(err);
            deferred.resolve(err);
            return;
        }

        if (returnData.status === 200) {
            addFullContactProfileToEs(email, returnData).then(function(status) {
                deferred.resolve(returnData);
                return;
            }, function(error) {
                sentryClient.captureMessage(error);
                deferred.resolve(returnData);
                return;
            });
        } else {
            deferred.resolve(returnData);
            return;
        }
    });

    return deferred.promise;
}

function addFullContactProfileToEsChunk(emails, socialProfiles) {
    var allPromises = [];

    for (var i = emails.length - 1; i >= 0; i--) {
        if (socialProfiles[i].status == 200) {
            var tempFunction = addFullContactProfileToEs(emails[i], socialProfiles[i]);
            allPromises.push(tempFunction);
        }
    }

    return Q.all(allPromises);
}

function getChunkLookupEmailProfiles(emails) {
    var deferred = Q.defer();
    var multi = fullcontact.multi();

    for (var i = 0; i < emails.length; i++) {
        multi.person.email(emails[i]);
    }

    multi.exec(function(err, resp) {
        if (err) {
            sentryClient.captureMessage(err);
            deferred.resolve([]);
            return;
        } else {
            var fullContactProfiles = [];
            for (var requestUrl in resp) {
                fullContactProfiles.push(resp[requestUrl]);
            }
            addFullContactProfileToEsChunk(emails, fullContactProfiles).then(function(status) {
                deferred.resolve(status);
                return;
            }, function(error) {
                sentryClient.captureMessage(err);
                deferred.resolve(fullContactProfiles);
                return;
            });
        }
    });

    return deferred.promise;
}

function getLookUpEmailProfiles(emails) {
    var allPromises = [];

    for (var i = emails.length - 1; i >= 0; i--) {
        emails[i] = emails[i].toLowerCase();
    }

    if (emails.length > 0) {
        var i, j, temp, chunk = 18;
        for (i = 0, j = emails.length; i < j; i += chunk) {
            temp = emails.slice(i, i + chunk);
            var tempFunction = getChunkLookupEmailProfiles(emails);
            allPromises.push(tempFunction);
        }
    }

    return Q.all(allPromises);
}

app.post('/fullcontactCallback', function(req, res) {
    var data = req.body;
    var email = data.webhookId;
    var result = data.result;
    var returnData = JSON.parse(result);

    utils.searchResourceInES(email, 'database', 'contacts').then(function(returnData) {
        // If email is in ES already then we resolve it
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(returnData._source));
        return;
    }, function(err) {
        if (returnData.status === 200) {
            var organizations = [];
            if (returnData && returnData.organizations) {
                var organizations = utils.addContactOrganizationsToES(email, returnData.organizations);
            }
            utils.addResourceToES(email, returnData, 'database', 'contacts').then(function(status) {
                utils.addContactMetadataToES(organizations, 'database', 'metadata1').then(function(status) {
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({
                        data: returnData
                    }));
                    return;
                }, function(error) {
                    // Return data not error. Doesn't matter if we fail to add metadata
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({
                        data: returnData
                    }));
                    return;
                });
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

app.get('/moz/:url', function(req, res) {
    var url = req.params.url;
    url = url.toLowerCase();

    if (url !== '') {
        var cols = "68719476736";
        var expires = Math.floor((Date.now() / 1000)) + 300;

        var stringToSign = mozAccessId + "\n" + expires;
        var signature = crypto.createHmac('sha1', mozSecretKey).update(stringToSign).digest('base64');
        signature = encodeURIComponent(signature);

        var postData = JSON.stringify([url]);

        var options = {
            hostname: 'lsapi.seomoz.com',
            path: '/linkscape/url-metrics/?Cols=' +
                cols + '&AccessID=' + mozAccessId +
                '&Expires=' + expires + '&Signature=' + signature,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        var responseData = '';

        var req = http.request(options, function(response) {
            response.setEncoding('utf8');
            response.on('data', function(chunk) {
                responseData += chunk;
            });
            response.on('end', function() {
                responseData = JSON.parse(responseData);
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({
                    data: responseData.length > 0 && responseData[0] || {}
                }));
                return;
            });
        });

        //Make the request.
        req.write(postData);
        req.end();
    } else {
        res.send('Missing URL');
        return;
    }
});

app.get('/company/:url', function(req, res) {
    var url = req.params.url;
    url = url.toLowerCase();

    if (url !== '') {
        utils.searchResourceInES(url, 'database', 'companies').then(function(returnData) {
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
                    utils.addResourceToES(url, returnData, 'database', 'companies').then(function(status) {
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
        res.send('Missing URL');
        return;
    }
});

app.get('/md/:email', function(req, res) {
    var email = req.params.email;
    email = email.toLowerCase();

    if (email !== '') {
        utils.searchResourceInES(email, 'md', 'contacts1').then(function(returnData) {
            // If email is in ES already then we resolve it
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(returnData._source));
            return;
        }, function(err) {
            res.setHeader('Content-Type', 'application/json');
            res.status(500).send(JSON.stringify({
                data: {
                    Status: 500
                }
            }));
            return;
        });
    } else {
        res.send('Missing email');
        return;
    }
});

app.get('/verify/:email', function(req, res) {
    var email = req.params.email;
    email = email.toLowerCase();

    if (email !== '') {
        fullcontactVerify.verification.email(email, function(err, returnData) {
            if (err) {
                // If FullContact has no data on the url
                sentryClient.captureMessage(err);
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({
                    data: err
                }));
                return;
            }

            var emailMap = returnData.emails;
            returnData.emails = [];

            Object.keys(emailMap).map(function(key, index) {
                returnData.emails.push(emailMap[key]);
            });

            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({
                data: returnData
            }));
            return;
        });
    } else {
        res.send('Missing email');
        return;
    }
});

app.post('/md', function(req, res) {
    var data = req.body;

    var organizations = [];
    var organizationNames = [];
    if (data && data.data && data.data.organizations) {
        var organizations = utils.addContactOrganizationsToES(data.data.email, data.data.organizations);

        for (var i = 0; i < data.data.organizations.length; i++) {
            // Format ID of email
            if (data.data.organizations[i].name && data.data.organizations[i].name !== '') {
                var organizationNameWithoutSpecial = data.data.organizations[i].name.replace(/[^a-zA-Z ]/g, "");
                organizationNameWithoutSpecial = organizationNameWithoutSpecial.replace(/[\u00A0\u1680​\u180e\u2000-\u2009\u200a​\u200b​\u202f\u205f​\u3000]/g, '')
                organizationNameWithoutSpecial = organizationNameWithoutSpecial.toLowerCase();
                organizationNameWithoutSpecial = organizationNameWithoutSpecial.split(' ').join('-');

                var organization = {
                    '_id': organizationNameWithoutSpecial,
                    'organizationName': data.data.organizations[i].name
                };

                organizationNames.push(organization);
            }

            // ES has issues with date-times that are not formatted the same way
            if (data.data.organizations[i].startDate) {
                var splitStartDate = data.data.organizations[i].startDate.split('-');
                if (splitStartDate.length == 2) {
                    data.data.organizations[i].startDate += '-01'
                }
            }

            if (data.data.organizations[i].endDate) {
                var splitEndDate = data.data.organizations[i].endDate.split('-');
                if (splitEndDate.length == 2) {
                    data.data.organizations[i].endDate += '-01'
                }
            }
        }
    }

    var rssFeeds = [];
    if (data && data.data && data.data.writingInformation && data.data.writingInformation.rss) {
        for (var i = 0; i < data.data.writingInformation.rss.length; i++) {
            var momentTime = moment().format('YYYY-MM-DDTHH:mm:ss');

            var rssFeed = {
                '_id': data.data.writingInformation.rss[i],
                'URL': data.data.writingInformation.rss[i],
                'Created': momentTime,
                'Updated': momentTime
            };

            rssFeeds.push(rssFeed);
        }
    }

    var socialProfiles = [];
    if (data && data.data && data.data.socialProfiles) {
        for (var i = 0; i < data.data.socialProfiles.length; i++) {
            var momentTime = moment().format('YYYY-MM-DDTHH:mm:ss');
            var username = data.data.socialProfiles[i].username;
            var socialNetwork = data.data.socialProfiles[i].typeId;

            if (username && socialNetwork && username !== '' && socialNetwork !== '') {
                socialNetwork = socialNetwork.toLowerCase();
                username = username.toLowerCase();
                var socialInformation = {
                    '_id': socialNetwork + '-' + username,
                    'Username': username,
                    'Created': momentTime,
                    'Network': socialNetwork,
                    'Email': data.data.email
                };

                socialProfiles.push(socialInformation);
            }
        }
    }

    utils.addResourceToES(data.data.email, data.data, 'md', 'contacts1').then(function(status) {
        utils.addContactMetadataToES(organizations, 'md', 'metadata1').then(function(status) {
            utils.addContactMetadataToES(organizationNames, 'md', 'publications').then(function(status) {
                utils.addContactMetadataToES(rssFeeds, 'md', 'feeds').then(function(status) {
                    utils.addContactMetadataToES(socialProfiles, 'md', 'socialProfiles').then(function(status) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({
                            data: data.data
                        }));
                        return;
                    }, function(error) {
                        // Return data not error. Doesn't matter if we fail to add metadata
                        sentryClient.captureMessage(error);
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({
                            data: data.data
                        }));
                        return;
                    });
                }, function(error) {
                    // Return data not error. Doesn't matter if we fail to add metadata
                    sentryClient.captureMessage(error);
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({
                        data: data.data
                    }));
                    return;
                });
            }, function(error) {
                // Return data not error. Doesn't matter if we fail to add metadata
                sentryClient.captureMessage(error);
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({
                    data: data.data
                }));
                return;
            });
        }, function(error) {
            // Return data not error. Doesn't matter if we fail to add metadata
            sentryClient.captureMessage(error);
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({
                data: data.data
            }));
            return;
        });
    }, function(error) {
        sentryClient.captureMessage(error);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({
            data: error
        }));
        return;
    });
});

app.get('/fullcontact/:email', function(req, res) {
    var email = req.params.email;
    email = email.toLowerCase();

    if (email !== '') {
        utils.searchResourceInES(email, 'database', 'contacts').then(function(returnData) {
            // If email is in ES already then we resolve it
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(returnData._source));
            return;
        }, function(err) {
            // If email is not in ES then we look it up
            getFullContactProfile(email).then(function(returnData) {
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
        });
    } else {
        res.send('Missing email');
        return;
    }
});

app.post('/fullcontact', function(req, res) {
    var data = req.body;
    var emails = data.emails;

    for (var i = emails.length - 1; i >= 0; i--) {
        emails[i] = emails[i].toLowerCase();
    }

    if (emails.length > 0) {
        utils.bulkSearchResourceInES(emails, 'database', 'contacts').then(function(returnData) {
            // If email is in ES already then we resolve it
            if (returnData.docs && returnData.docs.length > 0) {
                var profiles = [];
                var lookupEmails = [];
                for (var i = 0; i < returnData.docs.length; i++) {
                    if (returnData.docs[i].found) {
                        returnData.docs[i]._source.data.email = returnData.docs[i]._id;
                        profiles.push(returnData.docs[i]._source.data);
                    } else {
                        lookupEmails.push(returnData.docs[i]._id);
                    }
                }

                getLookUpEmailProfiles(lookupEmails, 'database', 'contacts').then(function(lookupProfiles) {
                    if (lookupProfiles.length > 0) {
                        lookupProfiles = lookupProfiles[0];
                        for (var i = lookupProfiles.length - 1; i >= 0; i--) {
                            if (lookupProfiles[i] && Object.keys(lookupProfiles[i]).length > 0) {
                                profiles.push(lookupProfiles[i]);
                            }
                        }
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({
                        data: profiles
                    }));
                    return;
                }, function(err) {
                    sentryClient.captureMessage(err);
                    console.error(err);
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({
                        data: profiles
                    }));
                    return;
                });
            } else {
                var err = 'No profiles found'
                sentryClient.captureMessage(err);
                console.error(err);
                res.send('An error occurred');
                return;
            }
        }, function(err) {
            // If email is not in ES then we look it up
            sentryClient.captureMessage(err);
            console.error(err);
            res.send('An error occurred');
            return;
        });
    } else {
        res.send('Missing emails');
        return;
    }
});

app.get('/twitter/:email/:twitteruser', function(req, res) {
    var twitterUser = req.params.twitteruser;
    var email = req.params.email;
    twitterUser = twitterUser.toLowerCase();
    email = email.toLowerCase();

    if (email !== '' || twitterUser !== '') {
        utils.searchResourceInES(email, 'database', 'twitters').then(function(returnData) {
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
                    utils.addResourceToES(email, returnData, 'database', 'twitters').then(function(status) {
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

    utils.searchResourceInES(email, 'database', 'contacts').then(function(returnData) {
        // If email is in ES already then we resolve it
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(returnData._source));
        return;
    }, function(error) {
        utils.searchResourceInES(email, 'database', 'twitters').then(function(returnData) {
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

/*
    * Must be able to have multiple queries together
        - People at X publication, who's title is Y, and headlines are Z.
    * Possible Queries:
        1. Lookup a publication name
        2. Lookup a title

        => Fetch contact profiles from /contacts endpoint

    * Necessary things:
        - Pagination
        - AND queries
*/
app.get('/lookup/query', function(req, res) {
    var query = req.query.q;
    if (!query || query === '') {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({
            data: []
        }));
        return;
    }

    var splitQuery = query.split(':');
    var publicationPosition = splitQuery.indexOf("publication");
    var titlePosition = splitQuery.indexOf("title");
    if (publicationPosition > -1 && splitQuery.length > 1) {
        utils.searchResourceForQuery(splitQuery[publicationPosition + 1]).then(function(emails) {
            var contactEmails = [];

            if (emails && emails.hits && emails.hits.hits) {
                for (var i = 0; i < emails.hits.hits.length; i++) {
                    if (emails.hits.hits[i] && emails.hits.hits[i]._source && emails.hits.hits[i]._source.data && emails.hits.hits[i]._source.data.email) {
                        contactEmails.push(emails.hits.hits[i]._source.data.email);
                    }
                }
            }

            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(emails.hits.hits));
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
            data: []
        }));
        return;
    }
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