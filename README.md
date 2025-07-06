# Free disk space GitHub Action

Free up disk space on Ubuntu GitHub runners.

Inspired by https://carlosbecker.com/posts/github-actions-disk-space/

## Inputs
- `desired-space`: Desired free space in MB, action will error if this free space isn't available.
- `audit-space`: Record disk space used by every directory on the filesystem and upload as an artifact.

## Outputs
- `available-space`: Available space

## Example

```yaml
jobs:
  free-space:
    runs-on: ubuntu-24.04
    steps:
      - name: Free up disk space on GitHub runner
        uses: manics/action-free-disk-space@1.0.0
        with:
          desired-space: 40000
```
