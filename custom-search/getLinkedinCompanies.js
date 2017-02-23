var GoogleSearch = require('google-search');
var googleSearch = new GoogleSearch({
    key: 'AIzaSyAhS7N-A1EXvhrO0LKK2UQC2x80p1er920',
    cx: '007796437048823592026:2vilhjckrq4'
});

googleSearch.build({
    q: "Public Relations",
    start: 1,
    num: 10,
    siteSearch: "linkedin.com/company/"
}, function(error, response) {
    console.log(response);
    // console.log(response.items[0].pagemap.person);
});