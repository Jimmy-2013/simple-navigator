document.addEventListener('DOMContentLoaded', async () => { // 注意这里的 async
    const categoryList = document.getElementById('category-list');
    const bookmarkGrid = document.getElementById('bookmark-grid');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const addBookmarkBtn = document.getElementById('add-bookmark-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalForm = document.getElementById('modal-form');
    const cancelBtn = document.getElementById('cancel-btn');
    const itemNameInput = document.getElementById('item-name');
    const itemUrlInput = document.getElementById('item-url');
    const itemCategorySelect = document.getElementById('item-category');
    const nameGroup = document.getElementById('name-group');
    const urlGroup = document.getElementById('url-group');
    const categoryGroup = document.getElementById('category-group');
    const editItemId = document.getElementById('edit-item-id');
    const toggleCategoriesCheckbox = document.getElementById('toggle-categories');
    const importDataBtn = document.getElementById('import-data-btn');
    const backupDataBtn = document.getElementById('backup-data-btn');

    // 后端 API 的基础 URL
    const BACKEND_API_BASE_URL = '/api/data'; // Nginx 将 /api/data 代理到后端

    let data = {
        categories: [],
        bookmarks: [],
        collapsedCategories: {}
    };
    let activeCategoryId = null;
    let sortableInstances = {};

    // 修改后的 loadData 函数，从后端加载数据
    async function loadData() {
        try {
            const response = await fetch(BACKEND_API_BASE_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const backendData = await response.json();
            
            // 确保后端返回的数据结构完整
            if (backendData && backendData.categories && backendData.bookmarks) {
                data = { 
                    categories: backendData.categories,
                    bookmarks: backendData.bookmarks,
                    collapsedCategories: backendData.collapsedCategories || {} // 确保 collapsedCategories 存在
                };
            } else {
                console.warn("Backend data is incomplete or empty, initializing default data.");
                initializeDefaultData();
            }
        } catch (error) {
            console.error("Failed to load data from backend, initializing default data:", error);
            initializeDefaultData();
        }

        // 激活分类逻辑保持不变，但现在它将基于从后端加载的数据
        // 尝试从 localStorage 加载 activeCategoryId，如果后端数据中没有，则使用默认值
        const savedActiveCategory = localStorage.getItem('activeCategoryId');
        if (savedActiveCategory && (savedActiveCategory === 'all' || data.categories.some(c => c.id == savedActiveCategory))) {
            activeCategoryId = savedActiveCategory === 'all' ? 'all' : parseInt(savedActiveCategory);
        } else {
            activeCategoryId = data.categories.length > 0 ? data.categories[0].id : 'all';
        }
    }

    function initializeDefaultData() {
        data = {
            categories: [
                { id: 1, name: '常用网站' },
                { id: 2, name: '开发工具' }
            ],
            bookmarks: [
                { id: 1, categoryId: 1, name: 'Google', url: 'https://www.google.com' },
                { id: 2, categoryId: 1, name: 'Bilibili', url: 'https://www.bilibili.com' },
                { id: 3, categoryId: 2, name: 'GitHub', url: 'https://www.github.com' }
            ],
            collapsedCategories: {}
        };
    }

    // 修改后的 saveData 函数，保存数据到后端
    async function saveData() {
        try {
            const response = await fetch(BACKEND_API_BASE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log('Data saved to backend successfully.');
            // 仍然在 localStorage 中保存 activeCategoryId，因为它只与当前用户界面状态相关
            localStorage.setItem('activeCategoryId', activeCategoryId);
        } catch (error) {
            console.error('Failed to save data to backend:', error);
            // 如果保存失败，可以考虑回退到 localStorage 或显示错误消息
            // 为了简化，这里只打印错误，不回退
        }
    }

    function renderCategories() {
        categoryList.innerHTML = '';
        const allItem = document.createElement('li');
        allItem.textContent = '全部';
        allItem.dataset.id = 'all';
        if (activeCategoryId === 'all') {
            allItem.classList.add('active');
        }
        allItem.addEventListener('click', (e) => {
            if (e.target === allItem) { //确保点击的不是按钮
                activeCategoryId = 'all';
                saveData();
                render();
            }
        });
        categoryList.appendChild(allItem);

        data.categories.forEach(category => {
            const li = document.createElement('li');
            li.dataset.id = category.id;
            if (category.id == activeCategoryId) {
                li.classList.add('active');
            }

            const nameSpan = document.createElement('span');
            nameSpan.textContent = category.name;
            nameSpan.className = 'category-name';
            nameSpan.addEventListener('click', () => {
                activeCategoryId = category.id;
                saveData();
                render();
            });

            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'category-item-controls';

            const editBtn = document.createElement('button');
            editBtn.className = 'category-edit-btn';
            editBtn.innerHTML = '&#9998;'; // Pencil icon
            editBtn.title = '编辑分类';
            editBtn.onclick = () => openModal('editCategory', category);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'category-delete-btn';
            deleteBtn.innerHTML = '&times;'; // X icon
            deleteBtn.title = '删除分类';
            deleteBtn.onclick = async () => { // 标记为 async
                if (confirm(`确定要删除分类 "${category.name}" 吗？\n这将同时删除该分类下的所有书签！`)) {
                    const categoryId = category.id;
                    data.categories = data.categories.filter(c => c.id !== categoryId);
                    data.bookmarks = data.bookmarks.filter(b => b.categoryId !== categoryId);
                    if (activeCategoryId === categoryId) {
                        activeCategoryId = 'all';
                    }
                    await saveData(); // 等待保存完成
                    render();
                }
            };

            controlsDiv.appendChild(editBtn);
            controlsDiv.appendChild(deleteBtn);
            li.appendChild(nameSpan);
            li.appendChild(controlsDiv);
            categoryList.appendChild(li);
        });
    }

    function renderBookmarks() {
        bookmarkGrid.innerHTML = '';
        Object.values(sortableInstances).forEach(instance => instance.destroy());
        sortableInstances = {};

        const showAll = activeCategoryId === 'all' || !toggleCategoriesCheckbox.checked;
        
        if (showAll) {
            data.categories.forEach(category => {
                const bookmarksInCategory = data.bookmarks.filter(b => b.categoryId === category.id);
                if (bookmarksInCategory.length > 0) {
                    const title = document.createElement('h2');
                    title.className = 'category-title';
                    title.textContent = category.name;
                    title.dataset.categoryId = category.id;
                    
                    const bookmarkGroup = document.createElement('div');
                    bookmarkGroup.className = 'bookmark-group';

                    if (data.collapsedCategories[category.id]) {
                        title.classList.add('collapsed');
                        bookmarkGroup.style.display = 'none';
                    }

                    title.addEventListener('click', async () => { // 标记为 async
                        const isCollapsed = title.classList.toggle('collapsed');
                        bookmarkGroup.style.display = isCollapsed ? 'none' : 'grid';
                        data.collapsedCategories[category.id] = isCollapsed;
                        await saveData(); // 等待保存完成
                    });

                    bookmarkGrid.appendChild(title);
                    bookmarkGrid.appendChild(bookmarkGroup);
                    
                    bookmarksInCategory.forEach(bookmark => {
                        bookmarkGroup.appendChild(createBookmarkElement(bookmark));
                    });
                    initSortable(bookmarkGroup, category.id);
                }
            });
        } else {
            const bookmarksToRender = data.bookmarks.filter(b => b.categoryId == activeCategoryId);
            if (bookmarksToRender.length > 0) {
                const bookmarkGroup = document.createElement('div');
                bookmarkGroup.className = 'bookmark-group';
                bookmarkGrid.appendChild(bookmarkGroup);
                bookmarksToRender.forEach(bookmark => {
                    bookmarkGroup.appendChild(createBookmarkElement(bookmark));
                });
                initSortable(bookmarkGroup, activeCategoryId);
            } else {
                const emptyMsg = document.createElement('p');
                emptyMsg.className = 'empty-message';
                emptyMsg.textContent = '该分类下暂无书签，快去添加一个吧！';
                bookmarkGrid.appendChild(emptyMsg);
            }
        }
    }

    function createBookmarkElement(bookmark) {
        const a = document.createElement('a');
        a.href = bookmark.url;
        a.className = 'bookmark-item';
        a.target = '_blank';
        a.dataset.id = bookmark.id;

        const favicon = document.createElement('img');
        favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=32`;
        favicon.alt = '';
        favicon.onerror = function() { this.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'; };

        const nameSpan = document.createElement('span');
        nameSpan.textContent = bookmark.name;

        const editBtn = document.createElement('button');
        editBtn.textContent = '编辑';
        editBtn.className = 'edit-btn';
        editBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openModal('editBookmark', bookmark);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '删除';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = async (e) => { // 标记为 async
            e.preventDefault();
            e.stopPropagation();
            if (confirm(`确定要删除书签 "${bookmark.name}" 吗？`)) {
                data.bookmarks = data.bookmarks.filter(b => b.id !== bookmark.id);
                await saveData(); // 等待保存完成
                render();
            }
        };

        a.appendChild(favicon);
        a.appendChild(nameSpan);
        a.appendChild(editBtn);
        a.appendChild(deleteBtn);
        return a;
    }

    function initSortable(element, categoryId) {
        if (element.children.length > 0) {
            sortableInstances[categoryId] = new Sortable(element, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: async function () { // 标记为 async
                    const newOrderIds = Array.from(element.children).map(item => parseInt(item.dataset.id));
                    const otherBookmarks = data.bookmarks.filter(b => b.categoryId != categoryId);
                    const newlySortedBookmarks = newOrderIds.map(id => {
                        return data.bookmarks.find(b => b.id === id);
                    });
                    data.bookmarks = [...otherBookmarks, ...newlySortedBookmarks];
                    await saveData(); // 等待保存完成
                },
            });
        }
    }

    function render() {
        renderCategories();
        renderBookmarks();
    }

    function openModal(type, item = null) {
        modalForm.reset();
        editItemId.value = '';

        if (type === 'addCategory') {
            modalTitle.textContent = '添加新分类';
            nameGroup.style.display = 'block';
            urlGroup.style.display = 'none';
            categoryGroup.style.display = 'none';
            modalForm.dataset.type = 'addCategory';
            itemNameInput.required = true;
            itemUrlInput.required = false;
            itemCategorySelect.required = false;
        } else if (type === 'editCategory' && item) {
            modalTitle.textContent = '编辑分类';
            nameGroup.style.display = 'block';
            urlGroup.style.display = 'none';
            categoryGroup.style.display = 'none';
            itemNameInput.value = item.name;
            editItemId.value = item.id;
            modalForm.dataset.type = 'editCategory';
            itemNameInput.required = true;
            itemUrlInput.required = false;
            itemCategorySelect.required = false;
        } else if (type === 'addBookmark') {
            modalTitle.textContent = '添加新书签';
            nameGroup.style.display = 'block';
            urlGroup.style.display = 'block';
            categoryGroup.style.display = 'block';
            populateCategorySelect();
            if (activeCategoryId && activeCategoryId !== 'all') {
                itemCategorySelect.value = activeCategoryId;
            }
            modalForm.dataset.type = 'addBookmark';
            itemNameInput.required = true;
            itemUrlInput.required = true;
            itemCategorySelect.required = true;
        } else if (type === 'editBookmark' && item) {
            modalTitle.textContent = '编辑书签';
            nameGroup.style.display = 'block';
            urlGroup.style.display = 'block';
            categoryGroup.style.display = 'block';
            populateCategorySelect();
            itemNameInput.value = item.name;
            itemUrlInput.value = item.url;
            itemCategorySelect.value = item.categoryId;
            editItemId.value = item.id;
            modalForm.dataset.type = 'editBookmark';
            itemNameInput.required = true;
            itemUrlInput.required = true;
            itemCategorySelect.required = true;
        }
        modalOverlay.classList.remove('hidden');
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
    }

    function populateCategorySelect() {
        itemCategorySelect.innerHTML = '';
        data.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            itemCategorySelect.appendChild(option);
        });
    }

    modalForm.addEventListener('submit', async (e) => { // 标记为 async
        e.preventDefault();
        const type = modalForm.dataset.type;
        const name = itemNameInput.value.trim();
        
        if (type === 'addCategory') {
            if (name) {
                const newCategory = { id: Date.now(), name: name };
                data.categories.push(newCategory);
                activeCategoryId = newCategory.id;
            }
        } else if (type === 'editCategory') {
            const id = parseInt(editItemId.value);
            const category = data.categories.find(c => c.id === id);
            if (category && name) {
                category.name = name;
            }
        } else if (type === 'addBookmark') {
            const url = itemUrlInput.value.trim();
            const categoryId = parseInt(itemCategorySelect.value);
            if (name && url && categoryId) {
                data.bookmarks.push({ id: Date.now(), categoryId, name, url });
            }
        } else if (type === 'editBookmark') {
            const id = parseInt(editItemId.value);
            const url = itemUrlInput.value.trim();
            const categoryId = parseInt(itemCategorySelect.value);
            const bookmarkIndex = data.bookmarks.findIndex(b => b.id === id);
            if (bookmarkIndex > -1) {
                data.bookmarks[bookmarkIndex] = { id, categoryId, name, url };
            }
        }

        await saveData(); // 等待保存完成
        render();
        closeModal();
    });

    addCategoryBtn.addEventListener('click', () => openModal('addCategory'));
    addBookmarkBtn.addEventListener('click', () => openModal('addBookmark'));
    cancelBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    toggleCategoriesCheckbox.addEventListener('change', renderBookmarks);

    backupDataBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date();
        const dateString = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}`;
        a.href = url;
        a.download = `navigator_backup_${dateString}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    importDataBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = e => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (event) => { // 标记为 async
                    try {
                        const importedData = JSON.parse(event.target.result);
                        if (importedData.categories && importedData.bookmarks) {
                            if (confirm('这将覆盖您当前的所有数据，确定要导入吗？')) {
                                data = { ...importedData, collapsedCategories: importedData.collapsedCategories || {} };
                                activeCategoryId = data.categories.length > 0 ? data.categories[0].id : 'all';
                                await saveData(); // 导入后立即保存到后端
                                render();
                                alert('数据导入成功！');
                            }
                        } else {
                            alert('文件格式无效！');
                        }
                    } catch (error) {
                        alert('解析文件时出错，请确保文件是有效的 JSON 格式。');
                    }
                };
                reader.readAsText(file);
            }
        };
        fileInput.click();
    });

    // 修复 updateToggleCategoriesCheckbox 函数，确保它能正确处理 undefined
    function updateToggleCategoriesCheckbox() {
        toggleCategoriesCheckbox.checked = !!data.collapsedCategories[activeCategoryId];
    }

    // 初始加载数据和渲染
    await loadData(); // 等待数据加载完成
    render();
});
