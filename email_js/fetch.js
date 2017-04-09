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

    var esBulkPost = [];

    for (var i = 0; i < esActions.length; i++) {
        var data = {
            _index: 'database',
            _type: 'internal1',
            _id: esActions[i].email
        }

        esBulkPost.push(data);
        esBulkPost.push({
            data: esActions[i]
        });
    }

    console.log(esBulkPost);

    client.bulk({
        body: esBulkPost
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

        deferred.resolve(data);
    }, function(error) {
        var data = {
            'email': email._source.data.email,
            'valid': false,
            'reason': error.message
        }
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
        });
    }, function(error) {
        console.error(error);
    });
}, function(error) {
    console.error(error);
});