#!/usr/bin/env bash
set -euo pipefail
project='project-25b363b8-50d5-4c00-ac5'
runtime="style-image-editor@${project}.iam.gserviceaccount.com"
builder="style-image-builder@${project}.iam.gserviceaccount.com"
linked_billing=$(gcloud billing projects describe "$project" --format='value(billingAccountName)')
if [[ "$linked_billing" != 'billingAccounts/014F94-9B0A67-A61C8F' ]]; then
  printf 'Unexpected billing account. Deployment stopped.\n' >&2
  exit 1
fi
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iam.googleapis.com aiplatform.googleapis.com --project="$project"
gcloud iam service-accounts describe "$runtime" --project="$project" >/dev/null 2>&1 || gcloud iam service-accounts create style-image-editor --display-name='Special Style image editing' --project="$project"
gcloud iam service-accounts describe "$builder" --project="$project" >/dev/null 2>&1 || gcloud iam service-accounts create style-image-builder --display-name='Special Style image service build' --project="$project"
gcloud iam roles describe styleImagePredictor --project="$project" >/dev/null 2>&1 || gcloud iam roles create styleImagePredictor --title='Special Style image prediction' --permissions=aiplatform.endpoints.predict,serviceusage.services.use --stage=GA --project="$project"
gcloud projects add-iam-policy-binding "$project" --member="serviceAccount:$runtime" --role="projects/$project/roles/styleImagePredictor" --condition=None --quiet >/dev/null
gcloud projects add-iam-policy-binding "$project" --member="serviceAccount:$builder" --role=roles/run.builder --condition=None --quiet >/dev/null
source_bucket="gs://run-sources-${project}-us-central1"
if gcloud storage buckets describe "$source_bucket" >/dev/null 2>&1; then
  gcloud storage buckets add-iam-policy-binding "$source_bucket" --member="serviceAccount:$builder" --role=roles/storage.objectViewer --quiet >/dev/null
fi

# These are the existing public app configuration values, never Google credentials.
python3 - <<'PY'
import json, pathlib, re
env = dict(re.findall(r'^([A-Z_]+)="([^"\n]*)"', pathlib.Path('.env').read_text(), re.M))
values = {
  'GOOGLE_CLOUD_PROJECT': 'project-25b363b8-50d5-4c00-ac5',
  'GOOGLE_IMAGE_MODEL': 'gemini-nano-banana-2.1',
  'SUPABASE_URL': env['VITE_SUPABASE_URL'],
  'SUPABASE_ANON_KEY': env['VITE_SUPABASE_PUBLISHABLE_KEY'],
}
pathlib.Path('/tmp/special-style-image-env.yaml').write_text('\n'.join(k + ': ' + json.dumps(v) for k, v in values.items()))
PY
gcloud run deploy special-style-image-editor --source=cloud/image-editor --project="$project" --region=us-central1 --service-account="$runtime" --build-service-account="projects/$project/serviceAccounts/$builder" --allow-unauthenticated --env-vars-file=/tmp/special-style-image-env.yaml --memory=512Mi --cpu=1 --concurrency=1 --max-instances=2 --min-instances=0 --timeout=240 --quiet
gcloud run services describe special-style-image-editor --project="$project" --region=us-central1 --format='value(status.url)'
