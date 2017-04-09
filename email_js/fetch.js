'use strict';

// External libraries
var Q = require('q');
var elasticsearch = require('elasticsearch');

// Internal libraries
var validate = require('./validate');

// Instantiate a elasticsearch client
var client = new elasticsearch.Client({
    host: 'https://newsai:XkJRNRx2EGCd6@search1.newsai.org',
    // log: 'trace',
    rejectUnauthorized: false
});

function bulkAddEleastic(esActions) {
    var deferred = Q.defer();

    client.bulk({
        body: esActions
    }, function(error, response) {
        if (error) {
            console.error(error);
            deferred.resolve(false);
        }
        deferred.resolve(true);
    });

    return deferred.promise;
}

function addToElastic(esActions) {
    var deferred = Q.defer();
    var allPromises = [];

    if (esActions.length > 0) {
        // Has to be an even number
        var i, j, temp, chunk = 50;
        for (i = 0, j = esActions.length; i < j; i += chunk) {
            temp = esActions.slice(i, i + chunk);

            var toExecute = bulkAddEleastic(temp);
            allPromises.push(toExecute);
        }
    }

    return Q.allSettled(allPromises);
}

function getInternalEmailPage(offset) {
    var deferred = Q.defer();

    client.search({
        index: 'database',
        type: 'internal1',
        body: {
            "size": 100,
            "from": 100 * offset
        }
    }).then(function(resp) {
        var hits = resp.hits.hits;
        deferred.resolve(hits);
    }, function(err) {
        console.trace(err.message);
        deferred.reject(err);
    });

    return deferred.promise;
}

function getInternalEmails(offset, allData) {
    var deferred = Q.defer();

    getInternalEmailPage(offset).then(function(data) {
        if (data.length === 0) {
            deferred.resolve(allData);
        } else {
            var newData = allData.concat(data);
            deferred.resolve(getInternalEmails(offset + 1, newData));
        }
    });

    return deferred.promise;
}

function processEmail(email) {
    var deferred = Q.defer();

    validate.verifyEmail(email._source.data.email).then(function(response) {
        var data = {}
        if (response.success) {
            data = {
                'email': email._source.data.email,
                'valid': true
            };
        } else {
            data = {
                'email': email._source.data.email,
                'valid': false,
                'reason': response.info
            };
        }

        data = {
            _index: 'database',
            _type: 'internal1',
            _id: email._source.data.email,
            data: data
        }
        deferred.resolve(data);
    }, function(error) {
        var data = {
            _index: 'database',
            _type: 'internal1',
            _id: email._source.data.email,
            data: {
                'email': email._source.data.email,
                'valid': false,
                'reason': error.message
            }
        };
        deferred.resolve(data);
    });

    return deferred.promise;
}

function processEmails(emails) {
    var deferred = Q.defer();
    var allPromises = [];

    for (var i = 0; i < emails.length; i++) {
        var toExecute = processEmail(emails[i]);
        allPromises.push(toExecute);
    }

    return Q.all(allPromises);
}

getInternalEmails(0, []).then(function(response) {
    processEmails(response).then(function(emails) {
        addToElastic(emails).then(function(elasticResponse) {
            console.log(elasticResponse);
        }, function(error) {
            console.error(error);
        })
    }, function(error) {
        console.error(error);
    });
}, function(error) {
    console.error(error);
});