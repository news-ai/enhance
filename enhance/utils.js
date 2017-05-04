'use strict';

var Q = require('q');
var elasticsearch = require('elasticsearch');
var raven = require('raven');

// Instantiate a elasticsearch client
var client = new elasticsearch.Client({
    host: 'https://newsai:XkJRNRx2EGCd6@search1.newsai.org',
    // log: 'trace',
    rejectUnauthorized: false
});

// Instantiate a sentry client
var sentryClient = new raven.Client('https://475ea5ee391b4ee797eb40e9ee7cad62:780b0e5e8f9341daa240aec8ad6f495a@sentry.io/121869');
sentryClient.patchGlobal();

var exports = module.exports = {};

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

    if (esActions.length > 0) {
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
    } else {
        deferred.resolve(true);
    }

    return deferred.promise;
}

function addResourceToES(email, fullContactData, typeName) {
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
            organizationNameWithoutSpecial = organizationNameWithoutSpecial.replace(/[\u00A0\u1680​\u180e\u2000-\u2009\u200a​\u200b​\u202f\u205f​\u3000]/g, '')
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

function searchResourceInES(resourceId, typeName) {
    var deferred = Q.defer();

    client.get({
        index: 'database',
        type: typeName,
        id: resourceId
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

function searchResourceForQuery(query, resourceName) {
    var deferred = Q.defer();

    client.search({
        index: 'database',
        type: resourceName,
        q: query
    }, function(error, response) {
        if (error) {
            sentryClient.captureMessage(error);
            deferred.reject(error);
        } else {
            console.log(response);
            deferred.resolve(response);
        }
    });

    return deferred.promise;
}

exports.addContactOrganizationsToES = addContactOrganizationsToES;
exports.searchResourceInES = searchResourceInES;
exports.addContactMetadataToES = addContactMetadataToES;
exports.addResourceToES = addResourceToES;
exports.searchResourceForQuery = searchResourceForQuery;