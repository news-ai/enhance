'use strict';

// External libraries
var Q = require('q');
var verifier = require('email-verify');

var validate = exports;

var emailOptions = {
    'sender': 'abhi@newsai.org'
};

function verifyEmail(email) {
    var deferred = Q.defer();

    verifier.verify(email, emailOptions, function(err, info) {
        if (err) {
            deferred.reject(new Error(err));
        } else {
            deferred.resolve(info);
        }
    });

    return deferred.promise;
}

validate.verifyEmail = verifyEmail;