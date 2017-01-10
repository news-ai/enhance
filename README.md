# enhance

Enhance influencer or contact information.

### Social network sync

Run celery: `celery worker -A taskrunner --beat -l info -c 5`

### Google Cloud

`gcloud compute --project "newsai-1166" ssh --zone "us-east1-c" "enhance-1"`
