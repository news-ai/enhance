# Stdlib imports
import os
import json
import sys

# Third-party app imports
from gcloud import pubsub

# Imports from app
from influencer.sync import linkedin_sync, twitter_sync


PROJECT_ID = 'newsai-1166'

if __name__ == '__main__':
    pubsub_client = pubsub.Client(PROJECT_ID)
    topic = pubsub_client.topic("influencer")
    sub = pubsub.Subscription("influencer_sub", topic=topic)
    while True:
        messages = sub.pull(return_immediately=False, max_messages=2)
        if messages:
            for ack_id, message in messages:
                # Parse JSON data and begin linkedin sync
                json_data = json.loads(message.data)
                json_data["justCreated"] = bool(json_data["justCreated"])
                if json_data["linkedinUrl"]:
                    linkedin_sync.delay(json_data["linkedinUrl"], json_data["Id"], json_data["justCreated"])
                elif json_data["twitterUrl"]:
                    twitter_sync.delay(json_data["twitterUrl"], json_data["Id"], json_data["justCreated"])
                
                # Acknowledge that we've gotten the message right away
                sub.acknowledge([ack_id])