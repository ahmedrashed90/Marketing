/**
 * MZJ Workspace - Zoho WorkDrive upload Web App
 * Deploy as Web App: Execute as Me, Who has access: Anyone with the link.
 * Required Script Properties:
 * ZOHO_CLIENT_ID
 * ZOHO_CLIENT_SECRET
 * ZOHO_REFRESH_TOKEN
 */
const ZOHO_ROOT_FOLDER_ID = '2t9fu5021a03afe4345ae948f12e948610011';
const ZOHO_ACCOUNTS_BASE = 'https://accounts.zoho.sa';
const ZOHO_API_BASE = 'https://www.zohoapis.sa/workdrive';
const ZOHO_WORKDRIVE_WEB = 'https://workdrive.zoho.sa';

function doGet() {
  return jsonOutput({
    ok: true,
    success: true,
    message: 'MZJ Zoho WorkDrive Upload API is running',
    rootFolderId: ZOHO_ROOT_FOLDER_ID
  });
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const meta = data.meta || {};

    const base64File = data.file || data.fileBase64 || data.base64 || data.content || '';
    const fileName = sanitizeName(data.name || data.fileName || data.filename || 'attachment');
    const mimeType = data.type || data.mimeType || data.contentType || 'application/octet-stream';

    if (!base64File || !fileName) {
      return jsonOutput({ ok: false, success: false, error: 'Missing file or name' });
    }

    const accessToken = getZohoAccessToken();

    const taskTypeFolder = getOrCreateZohoFolderCached(
      accessToken,
      ZOHO_ROOT_FOLDER_ID,
      meta.taskType || data.taskType || 'tasks'
    );

    const campaignLabel = [meta.campaignCode || data.campaignCode || '', meta.campaignName || data.campaignName || '']
      .filter(Boolean)
      .join(' - ') || meta.taskId || data.taskId || data.task_id || data.docId || data.id || 'general';

    const campaignFolder = getOrCreateZohoFolderCached(
      accessToken,
      taskTypeFolder.id,
      campaignLabel
    );

    const departmentFolder = getOrCreateZohoFolderCached(
      accessToken,
      campaignFolder.id,
      meta.departmentName || data.departmentName || meta.departmentKey || data.departmentKey || 'department'
    );

    const cleanBase64 = String(base64File).includes(',')
      ? String(base64File).split(',').pop()
      : String(base64File);

    const blob = Utilities.newBlob(
      Utilities.base64Decode(cleanBase64),
      mimeType,
      fileName
    );

    const uploadedFile = uploadFileToZohoWorkDrive(
      accessToken,
      departmentFolder.id,
      blob,
      fileName
    );

    const fileUrl = uploadedFile.permalink || uploadedFile.web_url || uploadedFile.download_url || '';

    return jsonOutput({
      ok: true,
      success: true,
      fileId: uploadedFile.id || '',
      id: uploadedFile.id || '',
      resource_id: uploadedFile.resource_id || uploadedFile.id || '',
      name: uploadedFile.name || fileName,
      fileName: uploadedFile.name || fileName,
      title: uploadedFile.name || fileName,
      url: fileUrl,
      fileUrl: fileUrl,
      viewUrl: fileUrl,
      webViewLink: fileUrl,
      downloadUrl: uploadedFile.download_url || '',
      mimeType: mimeType,
      folderId: departmentFolder.id,
      folderUrl: departmentFolder.permalink || '',
      taskId: meta.taskId || data.taskId || '',
      uploadedAt: new Date().toISOString(),
      message: 'File uploaded to Zoho WorkDrive successfully'
    });
  } catch (err) {
    console.log('DO POST ERROR:');
    console.log(String(err));
    return jsonOutput({ ok: false, success: false, error: String(err && err.message ? err.message : err) });
  }
}

function getZohoAccessToken() {
  const props = PropertiesService.getScriptProperties();
  const refreshToken = props.getProperty('ZOHO_REFRESH_TOKEN');
  const clientId = props.getProperty('ZOHO_CLIENT_ID');
  const clientSecret = props.getProperty('ZOHO_CLIENT_SECRET');

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('Missing Zoho OAuth script properties. Add ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN.');
  }

  const response = UrlFetchApp.fetch(ZOHO_ACCOUNTS_BASE + '/oauth/v2/token', {
    method: 'post',
    payload: {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();
  let json = {};
  try { json = JSON.parse(text); } catch (err) { throw new Error('Zoho token returned non-JSON. HTTP ' + code + ': ' + text); }
  if (code < 200 || code >= 300 || !json.access_token) {
    throw new Error('Zoho token error HTTP ' + code + ': ' + text);
  }
  return json.access_token;
}

function getOrCreateZohoFolderCached(accessToken, parentFolderId, folderName) {
  const cleanName = sanitizeName(folderName || 'folder');
  const props = PropertiesService.getScriptProperties();
  const cacheKey = 'ZOHO_FOLDER_' + parentFolderId + '_' + cleanName;
  const cachedFolderId = props.getProperty(cacheKey);

  if (cachedFolderId) {
    return {
      id: cachedFolderId,
      name: cleanName,
      permalink: ZOHO_WORKDRIVE_WEB + '/folder/' + cachedFolderId
    };
  }

  const folder = createZohoFolder(accessToken, parentFolderId, cleanName);
  if (!folder.id) {
    throw new Error('Zoho folder created but no folder id returned: ' + JSON.stringify(folder));
  }
  props.setProperty(cacheKey, folder.id);
  return folder;
}

function createZohoFolder(accessToken, parentFolderId, folderName) {
  const payload = {
    data: {
      attributes: {
        name: sanitizeName(folderName),
        parent_id: parentFolderId
      },
      type: 'files'
    }
  };

  const response = UrlFetchApp.fetch(ZOHO_API_BASE + '/api/v1/files', {
    method: 'post',
    contentType: 'application/vnd.api+json',
    headers: {
      Authorization: 'Zoho-oauthtoken ' + accessToken,
      Accept: 'application/vnd.api+json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();
  let json = {};
  try { json = JSON.parse(text); } catch (err) { throw new Error('Zoho create folder returned non-JSON. HTTP ' + code + ': ' + text); }
  if (code < 200 || code >= 300 || json.errors) {
    throw new Error('Zoho create folder error HTTP ' + code + ': ' + text);
  }

  const item = json.data || {};
  const attrs = item.attributes || {};
  return {
    id: item.id || attrs.resource_id || attrs.id || '',
    name: attrs.name || folderName,
    permalink: attrs.permalink || (item.id ? ZOHO_WORKDRIVE_WEB + '/folder/' + item.id : ''),
    raw: json
  };
}

function uploadFileToZohoWorkDrive(accessToken, folderId, blob, fileName) {
  const uploadUrl =
    ZOHO_API_BASE + '/api/v1/upload'
    + '?filename=' + encodeURIComponent(fileName)
    + '&override-name-exist=true'
    + '&parent_id=' + encodeURIComponent(folderId);

  const response = UrlFetchApp.fetch(uploadUrl, {
    method: 'post',
    headers: {
      Authorization: 'Zoho-oauthtoken ' + accessToken
    },
    payload: {
      content: blob
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();
  let json = {};
  try { json = JSON.parse(text); } catch (err) { throw new Error('Zoho upload returned non-JSON. HTTP ' + code + ': ' + text); }
  if (code < 200 || code >= 300 || json.errors) {
    throw new Error('Zoho upload error HTTP ' + code + ': ' + text);
  }
  if (!json.data || !json.data.length) {
    throw new Error('Zoho upload returned no data. HTTP ' + code + ': ' + text);
  }

  const item = json.data[0];
  const attrs = item.attributes || {};
  let fileInfo = {};
  if (attrs['File INFO']) {
    try { fileInfo = JSON.parse(attrs['File INFO']); } catch (err) { fileInfo = {}; }
  }

  const resourceId = attrs.resource_id || fileInfo.RESOURCE_ID || item.id || '';
  const fileUrl = attrs.permalink || attrs.web_url || (resourceId ? ZOHO_WORKDRIVE_WEB + '/file/' + resourceId : '');

  if (!resourceId) {
    throw new Error('Zoho upload returned no resource id: ' + text);
  }

  return {
    id: resourceId,
    resource_id: resourceId,
    name: attrs.FileName || attrs.name || fileName,
    parent_id: attrs.parent_id || folderId,
    download_url: attrs.download_url || '',
    permalink: fileUrl,
    web_url: fileUrl,
    raw: json
  };
}

function sanitizeName(value) {
  return String(value || 'بدون اسم')
    .replace(/[\\\/:*?"<>|#%{}~&]/g, '-')
    .trim()
    .slice(0, 120) || 'بدون اسم';
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
