# Stdlib imports
import datetime

# Third-party app imports
from gcloud import datastore

# Imports from app
from influencer.linkedin import LinkedInParser
from taskrunner import app

client = datastore.Client('newsai-1166')


def find_or_create_publisher(publisher_name):
    # Try get the publication
    query = client.query(kind='Publication')
    query.add_filter('Name', '=', publisher_name)
    results = list(query.fetch())
    if len(results) > 0:
        result = results[0]
        return result.key.id

    # Otherwise add it
    incomplete_key = client.key('Publication')
    new_publication = datastore.Entity(key=incomplete_key)
    if isinstance(publisher_name, str):
        publisher_name = unicode(publisher_name, "utf-8")
    current_time = datetime.datetime.utcnow()

    new_publication.update({
        'Name': publisher_name,
        'Created': current_time,
        'Updated': current_time,
        'CreatedBy': 0
    })
    client.put(new_publication)

    # Return key
    return new_publication.key.id


def update_datastore(linkedin_data, contact_id):
    key = client.key('Contact', int(contact_id))
    result = client.get(key)
    print result
    result["Employers"] = []
    result["PastEmployers"] = []

    # Current jobs
    if linkedin_data['current']:
        for job in linkedin_data['current']:
            employer_id = find_or_create_publisher(job['employer'])
            result["Employers"].append(employer_id)

    # Past jobs
    if linkedin_data['past']:
        for job in linkedin_data['past']:
            employer_id = find_or_create_publisher(job['employer'])
            result["PastEmployers"].append(employer_id)

    client.put(result)


@app.task
def linkedin_sync(linkedin_url, contact_id):
    linkedin_result = LinkedInParser(linkedin_url)
    linkedin_data = linkedin_result.get_profile()
    print linkedin_data
    if linkedin_data is None:
        return False
    update_datastore(linkedin_data, contact_id)
    return True
