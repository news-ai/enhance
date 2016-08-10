# Stdlib imports
from itertools import cycle

# Third-party app imports
import urllib2


def construct_opener():


    # Authentication
    password_mgr = urllib2.HTTPPasswordMgrWithDefaultRealm()
    url = 'proxy.crawlera.com:8010'
    username = 'd3f8e7a7ef0a4745a85abe3fcedaa390'
    password = ''
    password_mgr.add_password(None, url, username, password)
    auth_handler = urllib2.HTTPBasicAuthHandler(password_mgr)

    print 'g'

    # Setup proxy
    opener = urllib2.build_opener(
        auth_handler,
    )
    return opener
