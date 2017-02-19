import re
import socket
import smtplib
import dns.resolver

# Address used for SMTP MAIL FROM command
fromAddress = 'abhi@newsai.org'

# Simple Regex for syntax checking
regex = '^[_a-z0-9-]+(\.[_a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,4})$'


def check_email(address_to_verify):
    # Syntax check
    try:
        match = re.match(regex, address_to_verify)
        if match == None:
            return (False, 'Email invalid')

        # Get domain for DNS lookup
        splitAddress = address_to_verify.split('@')
        domain = str(splitAddress[1])
        print('Domain:', domain)

        # MX record lookup
        try:
            records = dns.resolver.query(domain, 'MX')
            mxRecord = records[0].exchange
            mxRecord = str(mxRecord)
        except Exception, e:
            return (False, 'Domain invalid')

        # Get local server hostname
        host = socket.gethostname()

        # SMTP lib setup (use debug level for full output)
        server = smtplib.SMTP()
        server.set_debuglevel(0)

        # SMTP Conversation
        server.connect(mxRecord)
        server.helo(host)
        server.mail(fromAddress)
        code, message = server.rcpt(str(address_to_verify))
        server.quit()

        # Assume SMTP response 250 is success
        if code == 250:
            return (True, '')
        else:
            return (False, 'MX false')
    except Exception, e:
        return (False, 'Unknown error')
