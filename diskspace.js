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
  const stat = await fs.statfs(path);
  const availableMB = Math.floor(stat.bsize * stat.bavail / 1000000)
  console.log(`Available disk space on ${path}: ${availableMB} MB`)
  return availableMB;
}

async function deleteDirectories(directories) {
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

async function createZeroFile(path, sizeMB) {
  chunkMB = 1000000;
  const zeroBuffer = Buffer.alloc(chunkMB, 0); // Fills with 0 by default
  let written = 0;

  let fileHandle = await fs.open(path, 'w');
  try {
    while (written < sizeMB) {
      const { bytesWritten: writtenThisIteration } = await fileHandle.write(zeroBuffer, 0, chunkMB);
      if (writtenThisIteration != chunkMB) {
        throw new Error("Failed to write chunk");
      }
      written += 1
    }
    await fileHandle.sync();
  } finally {
    await fileHandle.close();
  }
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

  if (args.length != 2) {
    console.log('Usage: node your_script_name.js <file_path> <size_in_mb>');
    process.exit(1);
  }
  const fileName = args[0];
  const desiredAvailableMB = parseInt(args[1]);

  let availableMB = await getFreeDiskSpaceMB("/");
  if (availableMB < desiredAvailableMB) {
    await deleteDirectories(directoriesToRemove);
    availableMB = await getFreeDiskSpaceMB("/");
  }

  const fillerMB = availableMB - desiredAvailableMB;
  if (fillerMB < 0) {
    console.error(`Available space ${availableMB} is less then desired ${desiredAvailableMB}`);
  } else {
    console.log(`Creating ${fillerMB} MB filler file`);
    createZeroFile(fileName, fillerMB);
    await fsSync();
    // fs.statfs doesn't seem to update ☹
    // availableMB = await getFreeDiskSpaceMB("/");
    availableMB -= fillerMB;
  }

  setGithubOutput("available-space", availableMB)
}

main()
