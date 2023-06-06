rm -rf data
pnpm start f 100

gsutil -m cp -r data gs://lheadsup/river/data
