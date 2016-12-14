var express = require('express');

var app = express();

app.get('/fullcontactCallback', function(req, res) {
    res.send('No ID present.');
});

app.get('/fullcontact', function(req, res) {
    res.send('No ID present.');
});

app.listen(8080, function() {
    console.log('Enhance app listening on port 8080!');
});