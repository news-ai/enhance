import os
from gcloud import storage, pubsub
import sys


PROJECT_ID = 'newsai-1166'

if __name__ == '__main__':
    pubsub_client = pubsub.Client(PROJECT_ID)
    topic = pubsub_client.topic("influencer")
    sub = pubsub.Subscription("influencer_sub", topic=topic)
    while True:
        messages = sub.pull(return_immediately=False, max_messages=2)
        if messages:
            for ack_id, message in messages:
                print message