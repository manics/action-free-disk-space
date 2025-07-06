const fs = require('fs/promises');
const { exec } = require('child_process');
const util = require('util');

// Promisify the exec function
const execPromise = util.promisify(exec);

const directoriesToRemove = [
  '/usr/local/lib/android',
  '/usr/local/.ghcup',
  '/opt/hostedtoolcache/CodeQL',
  '/opt/microsoft/',
  '/usr/local/share',
  '/usr/share/swift/',
];

async function getFreeDiskSpaceMB(path) {
  /**
   * Get the free disk space on <path> in MB
   */
  const stat = await fs.statfs(path);
  const availableMB = Math.floor(stat.bsize * stat.bavail / 1000000)
  console.log(`Available disk space on ${path}: ${availableMB} MB`)
  return availableMB;
}

async function deleteDirectories(directories) {
  /**
   * Delete directories in parallel
   */
  const deletionPromises = directories.map(async (dirPath) => {
    try {
      console.log(`Deleting: ${dirPath}`);
      await fs.rm(dirPath, { recursive: true, force: true });
      return { dirPath, status: 'success' };
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`Directory not found: ${dirPath}`);
        return { dirPath, status: 'error', reason: 'ENOENT - Directory not found' };
      } else if (error.code === 'EPERM' || error.code === 'EACCES') {
        console.error(`Permission denied: ${dirPath}`);
        return { dirPath, status: 'error', reason: 'EPERM/EACCES - Permission denied' };
      } else {
        console.error(`Error deleting ${dirPath}:`, error);
        return { dirPath, status: 'error', reason: `Unknown error: ${error.message}` };
      }
    }
  });

  const results = await Promise.allSettled(deletionPromises);

  let errors = 0;
  results.forEach(result => {
    if (result.status === 'error') {
      errors++;
    }
  });
  return errors;
}

async function setGithubOutput(name, value) {
  const githubOutputPath = process.env.GITHUB_OUTPUT;
  if (!githubOutputPath) {
    throw new Error('GITHUB_OUTPUT environment variable not found');
  }
  await fs.appendFile(githubOutputPath, `${name}=${value}\n`);
}

async function fsSync() {
  console.log('Global filesystem sync');
  const { stdout, stderr } = await execPromise('sync');
  if (stdout) console.log('sync stdout:', stdout);
  if (stderr) console.error('sync stderr:', stderr);
}

async function main() {
  // arg0:node arg1:script
  const args = process.argv.slice(2);

  if (args.length != 1) {
    console.log('Usage: node your_script_name.js <desired-space-mb>');
    process.exit(2);
  }
  const desiredAvailableMB = parseInt(args[0]);

  let availableMB = await getFreeDiskSpaceMB("/");
  if (availableMB < desiredAvailableMB) {
    console.log("Deleting directories to free up space")
    await deleteDirectories(directoriesToRemove);
    availableMB = await getFreeDiskSpaceMB("/");
  } else {
    console.log("Sufficient free space, not deleting anything")
  }

  setGithubOutput("available-space", availableMB)

  if (availableMB < desiredAvailableMB) {
    console.error(`Available space ${availableMB} is less then desired ${desiredAvailableMB}`);
    process.exit(1);
  }
}

main()
