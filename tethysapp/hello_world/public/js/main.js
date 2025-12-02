document.addEventListener('DOMContentLoaded', function () {

  // --- MinIO Object Browser Functions ---
  let currentBucket = null;

  // 1. Load danh sách bucket và object từ API backend
  function loadBuckets() {
    fetch('/apps/hello-world/api/minio-list')
      .then(res => res.json())
      .then(data => {
        const buckets = data.buckets || [];
        const list = document.getElementById('bucket-list');
        if (!list) return;
        list.innerHTML = '';
        if (!buckets.length) {
          const li = document.createElement('li');
          li.textContent = 'No buckets found';
          li.className = 'text-white-50 px-4 py-2';
          list.appendChild(li);
          return;
        }
        buckets.forEach(bucketObj => {
          const bucket = bucketObj.bucket;
          const li = document.createElement('li');
          li.className = 'bucket-item d-flex align-items-center px-3 py-2 mb-1' + (bucket === currentBucket ? ' active' : '');
          li.style.cursor = 'pointer';
          li.onclick = () => selectBucket(bucket);
          li.innerHTML = `<span class="bucket-icon me-2"><i class="fa fa-database"></i></span><span class="bucket-name">${bucket}</span>`;
          list.appendChild(li);
        });
        // Nếu chưa chọn bucket nào, tự động chọn bucket đầu tiên
        if (!currentBucket && buckets.length > 0) {
          selectBucket(buckets[0].bucket, buckets);
        }
      });
  }

  // 2. Chọn bucket và load object từ API backend
  function selectBucket(bucketName, bucketsData, forceReload = false) {
    currentBucket = bucketName;
    // Hiển thị tên bucket
    const infoDiv = document.getElementById('bucket-info');
    if (infoDiv) {
      infoDiv.innerHTML = `<b>${bucketName}</b>`;
    }
    // Luôn reload từ API sau upload hoặc khi forceReload=true
    function renderObjects(objects) {
      const tbody = document.querySelector('#object-table tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (!objects || !objects.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" class="text-center text-secondary">No objects found</td>`;
        tbody.appendChild(tr);
        return;
      }
      objects.forEach(obj => {
        const name = obj.name || obj;
        const lastModified = obj.last_modified || '';
        const size = (obj.size !== undefined && obj.size !== null) ? (obj.size / 1024).toFixed(1) + ' KB' : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input type="checkbox" class="object-checkbox"></td>
          <td>${name}</td>
          <td>${lastModified}</td>
          <td>${size}</td>
        `;
        tbody.appendChild(tr);
      });
    }
    // Luôn reload từ API nếu forceReload hoặc không có bucketsData
    if (forceReload || !bucketsData) {
      fetch('/apps/hello-world/api/minio-list')
        .then(res => res.json())
        .then(data => {
          const buckets = data.buckets || [];
          const found = buckets.find(b => b.bucket === bucketName);
          renderObjects(found ? found.objects : []);
        });
    } else {
      // Nếu đã có dữ liệu buckets, lấy object từ đó
      const found = bucketsData.find(b => b.bucket === bucketName);
      renderObjects(found ? found.objects : []);
    }
    // Đánh dấu bucket đang chọn
    document.querySelectorAll('.bucket-item').forEach(li => {
      li.classList.toggle('active', li.textContent === bucketName);
    });
  }

  // 3. Tạo bucket mới
  const createBucketBtn = document.getElementById('create-bucket-btn');
  if (createBucketBtn) {
    createBucketBtn.onclick = function () {
      // Ưu tiên dùng Bootstrap modal nếu có
      var popup = document.getElementById('create-bucket-popup');
      if (window.bootstrap && window.bootstrap.Modal) {
        var modal = bootstrap.Modal.getOrCreateInstance(popup);
        modal.show();
      } else {
        popup.style.display = 'block';
        var overlay = document.getElementById('popup-overlay');
        if (overlay) overlay.style.display = 'block';
      }
    };
  }
  const cancelCreateBucket = document.getElementById('cancel-create-bucket');
  if (cancelCreateBucket) cancelCreateBucket.onclick = closePopups;

  const createBucketForm = document.getElementById('create-bucket-form');
  if (createBucketForm) {
    const nameInput = document.getElementById('new-bucket-name');
    const errorDiv = document.getElementById('create-bucket-error');
    const submitBtn = document.getElementById('submit-create-bucket');
    const clearBtn = document.getElementById('clear-create-bucket');
    // Hàm kiểm tra tên bucket hợp lệ (theo MinIO/S3)
    // Chuẩn S3/MinIO: 3-63 ký tự, chỉ chữ thường, số, -, . ; không bắt đầu/kết thúc bằng - hoặc . ; không có hai dấu . liên tiếp; không phải IP
    function isValidBucketName(name) {
      if (!name) return false;
      if (name.length < 3 || name.length > 63) return false;
      if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(name)) return false;
      if (/\.\./.test(name)) return false;
      if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return false;
      if (/(^-)|(-$)|(\.-)|(\.-$)|(^\.)|(\.$)/.test(name)) return false;
      return true;
    }
    function setError(msg) {
      if (errorDiv) {
        errorDiv.textContent = msg;
        errorDiv.style.display = msg ? '' : 'none';
      }
      if (nameInput) {
        nameInput.classList.toggle('is-invalid', !!msg);
      }
    }
    function updateCreateBtnState() {
      const val = nameInput.value.trim();
      if (!val) {
        setError('');
        submitBtn.disabled = true;
      } else if (!isValidBucketName(val)) {
        setError('Invalid bucket name');
        submitBtn.disabled = true;
      } else {
        setError('');
        submitBtn.disabled = false;
      }
    }
    if (nameInput) {
      nameInput.addEventListener('input', updateCreateBtnState);
      updateCreateBtnState();
    }
    // Xử lý submit
    createBucketForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!isValidBucketName(name)) {
        setError('Invalid bucket name');
        return;
      }
      setError('');
      if (submitBtn) submitBtn.disabled = true;
      fetch('/api/minio/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
        .then(async res => {
          let data = {};
          try { data = await res.json(); } catch { }
          if (!res.ok) {
            setError(data.error || data.message || 'Failed to create bucket');
            if (submitBtn) submitBtn.disabled = false;
            throw new Error('Create bucket failed');
          }
          return data;
        })
        .then((data) => {
          setError('');
          if (submitBtn) submitBtn.disabled = false;
          // Đóng popup, reload bucket list
          if (window.bootstrap && window.bootstrap.Modal) {
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('create-bucket-popup'));
            modal.hide();
          } else {
            document.getElementById('create-bucket-popup').style.display = 'none';
            document.getElementById('popup-overlay').style.display = 'none';
          }
          // Refresh bucket list
          loadBuckets();
        })
        .catch(() => { });
    });
    // Khi mở popup, reset trạng thái
    const popup = document.getElementById('create-bucket-popup');
    if (popup) {
      popup.addEventListener('show.bs.modal', function () {
        setError('');
        if (nameInput) {
          nameInput.value = '';
          nameInput.classList.remove('is-invalid');
        }
        if (typeof updateCreateBtnState === 'function') {
          updateCreateBtnState();
        } else if (submitBtn) {
          submitBtn.disabled = true;
        }
      });
    }
    // Nút Clear
    if (clearBtn) {
      clearBtn.onclick = function (e) {
        e.preventDefault();
        if (nameInput) {
          nameInput.value = '';
          nameInput.classList.remove('is-invalid');
        }
        setError('');
        if (submitBtn) submitBtn.disabled = true;
      };
    }
  }

  // 4. Upload file vào bucket
  // Upload dropdown logic
  const uploadFileMenu = document.getElementById('upload-file-menu');
  const uploadFolderMenu = document.getElementById('upload-folder-menu');
  const uploadFileInput = document.getElementById('upload-file');
  const uploadFolderInput = document.getElementById('upload-folder');
  const uploadPopup = document.getElementById('upload-popup');
  const popupOverlay = document.getElementById('popup-overlay');
  const cancelUpload = document.getElementById('cancel-upload');
  function bindUploadModalEvents() {
    if (uploadFileMenu && uploadFileInput) {
      uploadFileMenu.onclick = function (e) {
        e.preventDefault();
        uploadFileInput.value = '';
        uploadFileInput.click();
      };
      uploadFileInput.onchange = function () {
        if (uploadFileInput.files.length) {
          uploadPopup.style.display = 'block';
          if (popupOverlay) popupOverlay.style.display = 'block';
        }
      };
    }
    if (uploadFolderMenu && uploadFolderInput) {
      uploadFolderMenu.onclick = function (e) {
        e.preventDefault();
        uploadFolderInput.value = '';
        uploadFolderInput.click();
      };
      uploadFolderInput.onchange = function () {
        if (uploadFolderInput.files.length) {
          uploadPopup.style.display = 'block';
          if (popupOverlay) popupOverlay.style.display = 'block';
        }
      };
    }
  }
  bindUploadModalEvents();
  if (cancelUpload) cancelUpload.onclick = closePopups;

  const uploadForm = document.getElementById('upload-form');
  if (uploadForm) {
    uploadForm.onsubmit = function (e) {
      e.preventDefault();
      console.log('[UPLOAD DEBUG] Submit upload form');
      const fileInput = uploadFileInput;
      const folderInput = uploadFolderInput;
      const errorDiv = document.getElementById('upload-error');
      if (errorDiv) errorDiv.style.display = 'none';
      let files = [];
      if (fileInput && fileInput.files.length) files = Array.from(fileInput.files);
      else if (folderInput && folderInput.files.length) files = Array.from(folderInput.files);
      console.log('[UPLOAD DEBUG] Files:', files);
      if (!files.length) {
        console.log('[UPLOAD DEBUG] No files selected');
        return;
      }
      if (!currentBucket) {
        console.log('[UPLOAD DEBUG] No bucket selected');
        return;
      }
      // Helper: reset popup state
      function resetUploadPopup() {
        if (fileInput) fileInput.value = '';
        if (folderInput) folderInput.value = '';
        if (errorDiv) errorDiv.style.display = 'none';
        // Đảm bảo modal và overlay luôn đóng
        try {
          if (window.bootstrap && window.bootstrap.Modal) {
            const popup = document.getElementById('upload-popup');
            if (popup) {
              const modal = bootstrap.Modal.getOrCreateInstance(popup);
              modal.hide();
            }
          }
        } catch (e) { console.log('[UPLOAD DEBUG] Modal close error:', e); }
        // Ẩn overlay thủ công nếu còn
        const overlay = document.getElementById('popup-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        // Luôn gán lại sự kiện modal sau khi upload xong
        setTimeout(bindUploadModalEvents, 100);
      }
      // Nếu upload 1 file: dùng API mới
      if (files.length === 1) {
        const formData = new FormData();
        formData.append('file', files[0]);
        console.log(`[UPLOAD DEBUG] Sending POST to /apps/hello-world/api/minio-upload/${currentBucket}`);
        fetch(`/apps/hello-world/api/minio-upload/${currentBucket}`, {
          method: 'POST',
          body: formData
        })
          .then(async res => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              let msg = data.error || 'Failed to upload file.';
              if (errorDiv) {
                errorDiv.textContent = msg;
                errorDiv.style.display = 'block';
              } else {
                alert(msg);
              }
              console.log('[UPLOAD DEBUG] Upload failed:', msg);
              throw new Error(msg);
            }
            console.log('[UPLOAD DEBUG] Upload success');
            return res.json();
          })
          .then(() => {
            resetUploadPopup();
            setTimeout(() => selectBucket(currentBucket, null, true), 200);
          })
          .catch((err) => { console.log('[UPLOAD DEBUG] Error:', err); });
      } else {
        // Upload nhiều file (folder)
        const formData = new FormData();
        files.forEach(f => {
          // Đảm bảo giữ path thư mục nếu backend hỗ trợ (webkitRelativePath)
          if (f.webkitRelativePath) {
            formData.append('files', f, f.webkitRelativePath);
          } else {
            formData.append('files', f);
          }
        });
        console.log(`[UPLOAD DEBUG] Sending POST to /api/minio/buckets/${currentBucket}/upload-folder`);
        fetch(`/api/minio/buckets/${currentBucket}/upload-folder`, {
          method: 'POST',
          body: formData
        })
          .then(async res => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              let msg = data.error || 'Failed to upload folder.';
              if (errorDiv) {
                errorDiv.textContent = msg;
                errorDiv.style.display = 'block';
              } else {
                alert(msg);
              }
              console.log('[UPLOAD DEBUG] Upload folder failed:', msg);
              throw new Error(msg);
            }
            console.log('[UPLOAD DEBUG] Upload folder success');
            return res.json();
          })
          .then(() => {
            resetUploadPopup();
            setTimeout(() => selectBucket(currentBucket, null, true), 200);
          })
          .catch((err) => { console.log('[UPLOAD DEBUG] Error:', err); });
      }
    };
  }

  // 5. Refresh danh sách object
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.onclick = function () {
      if (currentBucket) selectBucket(currentBucket);
    };
  }

  // 6. Tìm kiếm bucket/object
  const bucketSearch = document.getElementById('bucket-search');
  if (bucketSearch) {
    bucketSearch.oninput = function () {
      const val = this.value.toLowerCase();
      document.querySelectorAll('.bucket-item').forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(val) ? '' : 'none';
      });
    };
  }
  const objectSearch = document.getElementById('object-search');
  if (objectSearch) {
    objectSearch.oninput = function () {
      const val = this.value.toLowerCase();
      document.querySelectorAll('#object-table tbody tr').forEach(tr => {
        tr.style.display = tr.children[1].textContent.toLowerCase().includes(val) ? '' : 'none';
      });
    };
  }

  // 7. Đóng popup
  function closePopups() {
    const popups = ['create-bucket-popup', 'upload-popup', 'popup-overlay'];
    popups.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    // Đảm bảo đóng modal bootstrap nếu có
    try {
      if (window.bootstrap && window.bootstrap.Modal) {
        document.querySelectorAll('.modal.show').forEach(m => {
          try { bootstrap.Modal.getOrCreateInstance(m).hide(); } catch { }
        });
      }
    } catch (e) { console.log('[POPUP DEBUG] Modal close error:', e); }
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  }

  // 8. Khởi tạo khi load trang
  loadBuckets();

  // --- Drag and drop for model list in legend popup ---
  const modelList = document.getElementById('model-list');
  if (modelList) {
    let dragSrcEl = null;
    modelList.querySelectorAll('.model-item').forEach(item => {
      item.addEventListener('dragstart', function (e) {
        dragSrcEl = item;
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
      });
      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (item !== dragSrcEl) {
          item.classList.add('drag-over');
        }
      });
      item.addEventListener('dragleave', function (e) {
        item.classList.remove('drag-over');
      });
      item.addEventListener('drop', function (e) {
        e.preventDefault();
        if (dragSrcEl && item !== dragSrcEl) {
          item.classList.remove('drag-over');
          // Swap elements
          if (dragSrcEl.nextSibling === item) {
            modelList.insertBefore(item, dragSrcEl);
          } else {
            modelList.insertBefore(dragSrcEl, item);
          }
        }
        if (dragSrcEl) dragSrcEl.classList.remove('dragging');
        dragSrcEl = null;
      });
      item.addEventListener('dragend', function (e) {
        modelList.querySelectorAll('.model-item').forEach(i => i.classList.remove('dragging', 'drag-over'));
        dragSrcEl = null;
      });
    });
  }
  // Form validation (nếu có form admin)
  var form = document.querySelector('.admin-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      var ten = document.querySelector('input[name="ten"]');
      if (ten && ten.value.trim() === '') {
        var err = document.getElementById('form-error');
        if (err) {
          err.textContent = 'Tên mô hình không được để trống!';
          err.style.display = 'block';
        }
        e.preventDefault();
        ten.focus();
        var card = document.querySelector('.add-model-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // Hàm gán lại sự kiện accordion cho các nút accordion-btn
  function bindAccordionEvents() {
    document.querySelectorAll('.accordion-btn').forEach(function (btn) {
      if (btn._accordionBound) return;
      btn._accordionBound = true;
      btn.addEventListener('click', function () {
        btn.classList.toggle('active');
        var panel = btn.nextElementSibling;
        if (panel) {
          if (panel.style.display === 'block') {
            panel.style.display = 'none';
            var arrow = btn.querySelector('.arrow');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
          } else {
            panel.style.display = 'block';
            var arrow = btn.querySelector('.arrow');
            if (arrow) arrow.style.transform = 'rotate(180deg)';
          }
        }
      });
    });
  }

  // Gán lần đầu khi DOM ready
  bindAccordionEvents();

  // --- Map code  ---
  const maptiler_api_key = 'wzxQ0qO1h59GmIszmcjI';
  const styleJson = {
    "version": 8,
    "name": "OpenStreetMap + GeoServer",
    "sources": {
      "basic": {
        "type": "raster",
        "tiles": [
          `https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}@2x.png?key=${maptiler_api_key}`
        ],
        "tileSize": 256
      },
      "streets": {
        "type": "raster",
        "tiles": [
          `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}@2x.png?key=${maptiler_api_key}`
        ],
        "tileSize": 256
      },
      "satellite": {
        "type": "raster",
        "tiles": [
          `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}@2x.jpg?key=${maptiler_api_key}`
        ],
        "tileSize": 256
      },
      "topo": {
        "type": "raster",
        "tiles": [
          `https://api.maptiler.com/maps/topo-v2/{z}/{x}/{y}@2x.png?key=${maptiler_api_key}`
        ],
        "tileSize": 256
      },
      "geoserver-diemktnuoc": {
        "type": "raster",
        "tiles": [
          "https://gis.tecotec.vn/geoserver/dwh/wms?service=WMS&version=1.1.0&request=GetMap&layers=dwh:diem_kt_nuoc_duoi_dat&bbox={bbox-epsg-3857}&width=256&height=256&srs=EPSG:3857&styles=&format=image/png&transparent=true"
        ],
        "tileSize": 256
      },
      "geoserver-htrg-thuyloi": {
        "type": "raster",
        "tiles": [
          "https://gis.tecotec.vn/geoserver/dwh/wms?service=WMS&version=1.1.0&request=GetMap&layers=dwh:htrg_he_thong_thuy_loi&bbox={bbox-epsg-3857}&width=256&height=256&srs=EPSG:3857&styles=&format=image/png&transparent=true"
        ],
        "tileSize": 256
      },
      "geoserver-giaothong": {
        "type": "raster",
        "tiles": [
          "https://gis.tecotec.vn/geoserver/gadm/wms?service=WMS&version=1.1.0&request=GetMap&layers=gadm:GiaoThong&bbox={bbox-epsg-3857}&width=256&height=256&srs=EPSG:3857&styles=&format=image/png&transparent=true"
        ],
        "tileSize": 256
      }
    },
    "layers": [
      { "id": "basic-base", "type": "raster", "source": "basic", "layout": { "visibility": "visible" } },
      { "id": "streets-base", "type": "raster", "source": "streets", "layout": { "visibility": "none" } },
      { "id": "satellite-base", "type": "raster", "source": "satellite", "layout": { "visibility": "none" } },
      { "id": "topo-base", "type": "raster", "source": "topo", "layout": { "visibility": "none" } },
      { "id": "diemktnuoc-layer", "type": "raster", "source": "geoserver-diemktnuoc", "layout": { "visibility": "none" } },
      { "id": "htrg-thuyloi-layer", "type": "raster", "source": "geoserver-htrg-thuyloi", "layout": { "visibility": "none" } },
      { "id": "giaothong-layer", "type": "raster", "source": "geoserver-giaothong", "layout": { "visibility": "none" } }
    ],
    "center": [105.8544, 21.0285],
    "zoom": 12
  };

  const map = new maplibregl.Map({
    container: 'map',
    style: styleJson
  });

  // Không tạo sidebar nữa, chỉ lấy ra
  const sidebar = document.getElementById('info-sidebar');
  const sidebarTitle = sidebar.querySelector('.sidebar-title');
  const sidebarDesc = sidebar.querySelector('.sidebar-desc');
  const sidebarTable = sidebar.querySelector('.sidebar-table');
  const sidebarClose = sidebar.querySelector('.sidebar-close');

  map.on('load', () => {
    console.log("Map loaded and ready");

    // Add click event to show info in sidebar
    map.on('click', function (e) {
      const width = map.getContainer().clientWidth;
      const height = map.getContainer().clientHeight;
      const layersInfo = [
        {
          id: 'diemktnuoc-layer',
          name: 'Điểm kiểm tra nước dưới đất',
          url: (bbox, x, y, w, h) => `https://gis.tecotec.vn/geoserver/dwh/wms?service=WMS&version=1.1.0&request=GetFeatureInfo&layers=dwh:diem_kt_nuoc_duoi_dat&bbox=${bbox}&width=${w}&height=${h}&srs=EPSG:4326&query_layers=dwh:diem_kt_nuoc_duoi_dat&info_format=application/json&x=${x}&y=${y}`
        },
        {
          id: 'htrg-thuyloi-layer',
          name: 'Hệ thống thủy lợi',
          url: (bbox, x, y, w, h) => `https://gis.tecotec.vn/geoserver/dwh/wms?service=WMS&version=1.1.0&request=GetFeatureInfo&layers=dwh:htrg_he_thong_thuy_loi&bbox=${bbox}&width=${w}&height=${h}&srs=EPSG:4326&query_layers=dwh:htrg_he_thong_thuy_loi&info_format=application/json&x=${x}&y=${y}`
        },
        {
          id: 'giaothong-layer',
          name: 'Giao thông',
          url: (bbox, x, y, w, h) => `https://gis.tecotec.vn/geoserver/gadm/wms?service=WMS&version=1.1.0&request=GetFeatureInfo&layers=gadm:GiaoThong&bbox=${bbox}&width=${w}&height=${h}&srs=EPSG:4326&query_layers=gadm:GiaoThong&info_format=application/json&x=${x}&y=${y}`
        }
      ];
      const bbox = `${map.getBounds().getWest()},${map.getBounds().getSouth()},${map.getBounds().getEast()},${map.getBounds().getNorth()}`;
      let anyData = false;
      let allTables = '';
      let promises = [];
      // Hiển thị trạng thái loading
      sidebarTitle.textContent = 'Đang tải dữ liệu...';
      sidebarDesc.textContent = '';
      sidebarTable.innerHTML = `<tr><td colspan='2' style='text-align:center;padding:24px 0;color:#1976d2;font-weight:bold;'>Đang tải dữ liệu...</td></tr>`;
      sidebar.classList.add('active');

      layersInfo.forEach(layer => {
        if (map.getLayoutProperty(layer.id, 'visibility') === 'visible') {
          const url = layer.url(bbox, Math.round(e.point.x), Math.round(e.point.y), width, height);
          promises.push(
            fetch(url)
              .then(response => response.json())
              .then(json => {
                if (json.features && json.features.length > 0) {
                  anyData = true;
                  const props = json.features[0].properties;
                  let tableHtml = `<div class='sidebar-layer-title' style="background:#e3f6fd;border-radius:8px 8px 0 0;padding:8px 12px;margin-top:16px;margin-bottom:0;font-weight:bold;color:#1976d2;border-bottom:2px solid #1976d2;">${layer.name}</div><table class='popup-table sidebar-table' style="margin-bottom:16px;border-radius:0 0 8px 8px;overflow:hidden;">`;
                  Object.entries(props).forEach(([key, value]) => {
                    tableHtml += `<tr><td class='popup-key'>${key}</td><td class='popup-value'>${value ?? ''}</td></tr>`;
                  });
                  tableHtml += '</table>';
                  allTables += tableHtml;
                }
              })
          );
        }
      });
      Promise.all(promises).then(() => {
        if (anyData) {
          sidebarTitle.textContent = 'Thông tin dữ liệu';
          sidebarDesc.textContent = '';
          sidebarTable.innerHTML = allTables;
          sidebar.classList.add('active');
        } else {
          sidebarTitle.textContent = 'Thông tin dữ liệu';
          sidebarDesc.textContent = '';
          sidebarTable.innerHTML = `<tr><td colspan='2' style='text-align:center;padding:24px 0;color:#888;'>Không có thông tin tại vị trí này.</td></tr>`;
          sidebar.classList.add('active');
        }
        // Gán lại sự kiện accordion sau khi cập nhật nội dung
        bindAccordionEvents();
      });
    });
    // Đóng sidebar

    sidebarClose.onclick = function () {
      sidebar.classList.remove('active');
    };
  });

  // Zoom buttons
  document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn());
  document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut());

  // Menu open/close
  const menuBtn = document.getElementById('menu-btn');
  const menu = document.getElementById('map-style-menu');
  const overlay = document.getElementById('menu-overlay');
  const closeBtn = document.getElementById('close-style-menu');
  // Sidebar 'Bản đồ' link (chọn theo id để chắc chắn)
  const sidebarMapLink = document.getElementById('sidebar-map-link');

  // Hiển thị menu sát sidebar, hiệu ứng chuyên nghiệp
  // Menu mở sát bên phải sidebar, gần nút Bản đồ
  const openMenu = () => {
    // Chỉ set left, giữ nguyên top theo CSS (top: 40px)
    if (sidebarMapLink && menu) {
      const rect = sidebarMapLink.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.left = (rect.right + 20) + 'px';
      // KHÔNG set lại top, giữ top theo CSS
      menu.style.transform = 'none';
    }
    menu.style.display = 'block';
    setTimeout(() => {
      menu.setAttribute('open', '');
      overlay.classList.add('active');
    }, 10);
  };
  const closeMenu = () => {
    menu.removeAttribute('open');
    overlay.classList.remove('active');
    setTimeout(() => { menu.style.display = 'none'; }, 350);
  };

  if (menuBtn) {
    menuBtn.addEventListener('click', openMenu);
  }
  if (sidebarMapLink) {
    sidebarMapLink.addEventListener('click', function (e) {
      e.preventDefault();
      openMenu();
    });
  }
  // Nếu tab 'Bản đồ' đang active khi load trang thì tự động mở menu
  if (sidebarMapLink && sidebarMapLink.classList.contains('active')) {
    setTimeout(openMenu, 300);
  }
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      closeMenu();
      // Đóng luôn sidebar nếu đang mở
      sidebar.style.display = 'none';
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  // Base map switch
  function switchBaseMap(layerId) {
    ['basic-base', 'streets-base', 'satellite-base', 'topo-base'].forEach(id => {
      map.setLayoutProperty(id, 'visibility', id === layerId ? 'visible' : 'none');
    });
  }

  document.querySelectorAll('.style-option').forEach(btn => {
    btn.addEventListener('click', () => {
      switchBaseMap(btn.dataset.layer);
      closeMenu();
    });
  });

  // Auto bind WMS checkbox toggle
  const wmsLayers = ['diemktnuoc-layer', 'htrg-thuyloi-layer', 'giaothong-layer'];
  // BBOX mặc định cho từng lớp geoserver (có thể điều chỉnh theo dữ liệu thực tế)
  // BBOX zoom sát thực tế cho từng lớp geoserver (ví dụ: Đồng bằng sông Cửu Long)
  const geoserverBounds = {
    'diemktnuoc-layer': [[104.5, 8.5], [106.8, 11.5]], // Sát vùng điểm kiểm tra nước
    'htrg-thuyloi-layer': [[104.5, 8.5], [106.8, 11.5]],
    'giaothong-layer': [[104.5, 8.5], [106.8, 11.5]]
  };
  wmsLayers.forEach(layerId => {
    const checkbox = document.getElementById(`toggle-${layerId.replace('-layer', '')}`);
    if (checkbox) {
      checkbox.addEventListener('change', e => {
        map.setLayoutProperty(layerId, 'visibility', e.target.checked ? 'visible' : 'none');
        if (e.target.checked) {
          // Tự động chuyển sang tab Bản đồ nếu chưa active
          if (sidebarMapLink && !sidebarMapLink.classList.contains('active')) {
            sidebarMapLink.click();
          }
          // Mở menu map-style nếu chưa mở
          if (menu && menu.style.display !== 'block') {
            openMenu();
          }
          // Zoom/fly đến vùng dữ liệu lớp geoserver
          if (geoserverBounds[layerId]) {
            map.fitBounds(geoserverBounds[layerId], { padding: 60, duration: 1200 });
          }
        }
      });
    }
  });

  // Xử lý hiện/ẩn popup Chú giải khi nhấn nút Chức năng
  console.log('JS loaded, checking popup...');
  var funcBtn = document.getElementById('function-btn');
  var legendPopup = document.getElementById('legend-popup');
  var closeLegend = document.getElementById('close-legend');
  if (funcBtn && legendPopup && closeLegend) {
    funcBtn.onclick = function (e) {
      e.stopPropagation();
      legendPopup.style.display = 'block';
    };
    closeLegend.onclick = function () {
      legendPopup.style.display = 'none';
    };
    document.addEventListener('click', function (e) {
      if (legendPopup.style.display === 'block' && !legendPopup.contains(e.target) && e.target !== funcBtn) {
        legendPopup.style.display = 'none';
      }
    });
  }
  // Xử lý hiện/ẩn popup thông báo khi nhấn chuông
  var notificationBtn = document.getElementById('notification-btn');
  var notificationPopup = document.getElementById('notification-popup');
  if (notificationBtn && notificationPopup) {
    notificationBtn.onclick = function (e) {
      e.stopPropagation();
      notificationPopup.style.display = (notificationPopup.style.display === 'none' || !notificationPopup.style.display) ? 'block' : 'none';
    };
    // Ẩn popup khi click ra ngoài
    document.addEventListener('click', function (e) {
      if (notificationPopup.style.display === 'block' && !notificationPopup.contains(e.target) && e.target !== notificationBtn) {
        notificationPopup.style.display = 'none';
      }
    });
  }
});