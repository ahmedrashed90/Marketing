/**
 * MZJ Workspace - Unified Google Drive upload Web App
 * Deploy as Web App: Execute as Me, Who has access: Anyone with the link.
 * Receives any campaign / agenda / task attachment and returns the Drive file URL.
 */
const ROOT_FOLDER_NAME = 'MZJ Workspace Uploads';

function doGet() {
  return jsonOutput({ ok: true, message: 'MZJ Drive Upload Web App is running.' });
}

function doPost(e) {
  try {
    const bodyText = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const body = JSON.parse(bodyText);
    if (body.action !== 'uploadTaskAttachment') throw new Error('Invalid action.');
    if (!body.base64) throw new Error('Missing file base64.');

    const meta = body.meta || {};
    const fileName = sanitizeName(body.fileName || ('attachment-' + new Date().getTime()));
    const mimeType = body.mimeType || 'application/octet-stream';
    const bytes = Utilities.base64Decode(body.base64);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);

    const root = getOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
    const taskTypeFolder = getOrCreateFolder_(root, sanitizeName(meta.taskType || 'tasks'));
    const campaignLabel = [meta.campaignCode, meta.campaignName].filter(Boolean).join(' - ') || meta.taskId || 'unknown-task';
    const campaignFolder = getOrCreateFolder_(taskTypeFolder, sanitizeName(campaignLabel));
    const departmentFolder = getOrCreateFolder_(campaignFolder, sanitizeName(meta.departmentName || meta.departmentKey || 'department'));

    const file = departmentFolder.createFile(blob);
    file.setDescription(JSON.stringify({
      taskId: meta.taskId || '',
      departmentIdentity: meta.departmentIdentity || '',
      departmentKey: meta.departmentKey || '',
      departmentName: meta.departmentName || '',
      uploadedBy: meta.uploadedBy || '',
      uploadedAt: new Date().toISOString()
    }));

    return jsonOutput({
      ok: true,
      fileId: file.getId(),
      name: file.getName(),
      fileName: file.getName(),
      url: file.getUrl(),
      fileUrl: file.getUrl(),
      mimeType: mimeType
    });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function getOrCreateFolder_(parent, name) {
  const cleanName = sanitizeName(name || 'folder');
  const folders = parent.getFoldersByName(cleanName);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(cleanName);
}

function sanitizeName(value) {
  return String(value || 'بدون اسم').replace(/[\\/:*?"<>|#%{}~&]/g, '-').trim().slice(0, 120) || 'بدون اسم';
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
