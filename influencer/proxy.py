# Stdlib imports
from itertools import cycle

# Third-party app imports
import urllib2

proxies = [
    "201.172.124.203",
    "120.198.248.96",
    "113.254.104.207",
    "203.210.8.41"
]
proxy_cycle = cycle(proxies)


def construct_opener():
    proxy = urllib2.ProxyHandler({'https': proxy_cycle.next()})
    opener = urllib2.build_opener(
        proxy,
        # urllib2.HTTPRedirectHandler(),
        # urllib2.HTTPHandler(debuglevel=0),
        # urllib2.HTTPSHandler(debuglevel=0),
    )
    return opener
