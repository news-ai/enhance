### Email

Loop through `internal1` everyday and validate emails. Runs everyday.

`ssh root@138.197.30.2`

Email responses from verify:

```
{ success: true,
  info: 'jana.adler@gmail.com is a valid address',
  addr: 'jana.adler@gmail.com' }
```

```
Error: Error: queryMx ENOTFOUND wednohmedia.com
    at Object.callback (/root/enhance/email_js/validate.js:20:29)
    at dns.resolveMx (/root/enhance/email_js/node_modules/email-verify/index.js:98:14)
    at QueryReqWrap.asyncCallback [as callback] (dns.js:62:16)
    at QueryReqWrap.onresolve [as oncomplete] (dns.js:219:10)
```

```
{ success: false,
  info: 'Invalid Email Structure',
  addr: 'http://www.adelto.co.uk/submit-articles/',
  params:
   { email: 'http://www.adelto.co.uk/submit-articles/',
     options:
      { sender: 'abhi@newsai.org',
        port: 25,
        timeout: 0,
        fqdn: 'mail.example.org',
        ignore: false },
     callback: [Function] } }
```
