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
    print linkedin_data

    key = client.key('Contact', int(contact_id))
    result = client.get(key)
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
def linkedin_sync(linkedin_url, contact_id, just_created):
    linkedin_result = LinkedInParser(linkedin_url)
    linkedin_data = linkedin_result.get_profile()

    # Both of these cases mean that the data did not load
    if not linkedin_data:
        # If the data is false and they just created it
        # Then we'll try a little harder
        retry_number = 5
        if just_created:
            # Re-try five more times
            retry_number = 10
        for x in xrange(1, retry_number):
            linkedin_result = LinkedInParser(linkedin_url)
            linkedin_data = linkedin_result.get_profile()
            print linkedin_data
            if linkedin_data:
                print linkedin_data
                break

    # Lets see if it works this time!
    # If not then something is invalid
    if not linkedin_data:
        return False

    # Data loaded from Linkedin
    update_datastore(linkedin_data, contact_id)
    return True
