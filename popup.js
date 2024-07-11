console.log("Popup script loaded");

let allApiCalls = [];

document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM content loaded");
  loadApiList();
  document.getElementById('exportBtn').addEventListener('click', exportToPostman);
  document.getElementById('clearBtn').addEventListener('click', clearLogs);
  document.getElementById('domainFilter').addEventListener('input', filterApiCalls);
  document.getElementById('trackHeaders').addEventListener('change', updateHeaderTracking);
  
  // Add event listeners for method checkboxes
  ['Get', 'Post', 'Put', 'Delete', 'Options'].forEach(method => {
    document.getElementById(`method${method}`).addEventListener('change', filterApiCalls);
  });

  // Load initial header tracking state
  browser.storage.local.get('trackHeaders').then(result => {
    document.getElementById('trackHeaders').checked = result.trackHeaders !== false;
  });
});

function updateHeaderTracking() {
  const trackHeaders = document.getElementById('trackHeaders').checked;
  browser.storage.local.set({trackHeaders: trackHeaders});
  browser.runtime.sendMessage({action: "updateHeaderTracking", trackHeaders: trackHeaders});
}

function loadApiList() {
  console.log("Loading API list");
  browser.runtime.sendMessage({action: "getApiCalls"}).then(response => {
    console.log("Received API calls:", response.apiCalls);
    allApiCalls = response.apiCalls;
    filterApiCalls();
  }).catch(error => {
    console.error('Error loading API list:', error);
  });
}

function displayApiCalls(calls) {
  const apiList = document.getElementById('apiList');
  apiList.innerHTML = '';
  calls.forEach((call, index) => {
    const apiItem = document.createElement('div');
    apiItem.className = 'api-item';
    apiItem.innerHTML = `
      <strong>${call.method} ${call.url}</strong><br>
      ${call.headers ? `Headers: ${JSON.stringify(call.headers)}<br>` : ''}
      Body: ${JSON.stringify(call.requestBody)}
    `;
    apiList.appendChild(apiItem);
  });
}

function filterApiCalls() {
  const filterValue = document.getElementById('domainFilter').value.toLowerCase();
  const methodFilters = ['Get', 'Post', 'Put', 'Delete', 'Options'].reduce((acc, method) => {
    acc[method.toLowerCase()] = document.getElementById(`method${method}`).checked;
    return acc;
  }, {});

  const filteredCalls = allApiCalls.filter(call => {
    try {
      const url = new URL(call.url);
      const domainMatch = url.hostname.toLowerCase().includes(filterValue);
      const methodMatch = methodFilters[call.method.toLowerCase()];
      return domainMatch && methodMatch;
    } catch (e) {
      return false;
    }
  });
  displayApiCalls(filteredCalls);
}

function exportToPostman() {
  console.log("Export to Postman clicked");
  const filterValue = document.getElementById('domainFilter').value.toLowerCase();
  const methodFilters = ['Get', 'Post', 'Put', 'Delete', 'Options'].reduce((acc, method) => {
    acc[method.toLowerCase()] = document.getElementById(`method${method}`).checked;
    return acc;
  }, {});
  const excludeCookies = document.getElementById('excludeCookies').checked;

  const filteredCalls = allApiCalls.filter(call => {
    try {
      const url = new URL(call.url);
      const domainMatch = url.hostname.toLowerCase().includes(filterValue);
      const methodMatch = methodFilters[call.method.toLowerCase()];
      return domainMatch && methodMatch;
    } catch (e) {
      return false;
    }
  });

  let postmanCollection = {
    info: {
      name: "Exported API Calls",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: filteredCalls.map(call => ({
      name: call.url,
      request: {
        url: call.url,
        method: call.method,
        header: call.headers ? Object.entries(call.headers)
          .filter(([key]) => !excludeCookies || key.toLowerCase() !== 'cookie')
          .map(([key, value]) => ({
            key: key,
            value: value
          })) : [],
        body: call.requestBody ? {
          mode: "raw",
          raw: JSON.stringify(call.requestBody)
        } : undefined
      }
    }))
  };

  let blob = new Blob([JSON.stringify(postmanCollection, null, 2)], {type: 'application/json'});
  let url = URL.createObjectURL(blob);
  
  console.log("Initiating download");
  browser.downloads.download({
    url: url,
    filename: 'postman_collection.json',
    saveAs: false
  }).then(downloadId => {
    console.log('Download started with ID:', downloadId);
    URL.revokeObjectURL(url);
  }).catch(error => {
    console.error('Download failed:', error);
    alert('Download failed. Error: ' + error.message);
  });
}

function clearLogs() {
  console.log("Clear logs clicked");
  browser.runtime.sendMessage({action: "clearApiCalls"}).then(response => {
    if (response.success) {
      console.log("Logs cleared successfully");
      allApiCalls = [];
      filterApiCalls();
    }
  }).catch(error => {
    console.error('Error clearing logs:', error);
    alert('Error clearing logs: ' + error.message);
  });
}