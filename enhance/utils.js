'use strict';

var exports = module.exports = {};

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

exports.addContactOrganizationsToES = addContactOrganizationsToES;