document.addEventListener('DOMContentLoaded', async () => {
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
    const allowDraggingCheckbox = document.getElementById('allow-dragging-categories');
    // 新增：获取一键展开/收起按钮
    const expandAllBtn = document.getElementById('expand-all-btn');
    const collapseAllBtn = document.getElementById('collapse-all-btn');

    const BACKEND_API_BASE_URL = '/api/data';

    let data = {
        categories: [],
        bookmarks: [],
        collapsedCategories: {}
    };
    let activeCategoryId = null;
    let sortableInstances = {}; // For bookmark groups
    let categorySortableInstance = null; // For category list
    let allowDraggingCategories = false; // 拖拽分类的开关状态，默认关闭

    async function loadData() {
        try {
            const response = await fetch(BACKEND_API_BASE_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const backendData = await response.json();
            
            if (backendData && backendData.categories && backendData.bookmarks) {
                data = { 
                    categories: backendData.categories,
                    bookmarks: backendData.bookmarks,
                    collapsedCategories: backendData.collapsedCategories || {}
                };
            } else {
                console.warn("Backend data is incomplete or empty, initializing default data.");
                initializeDefaultData();
            }
        } catch (error) {
            console.error("Failed to load data from backend, initializing default data:", error);
            initializeDefaultData();
        }

        const savedActiveCategory = localStorage.getItem('activeCategoryId');
        if (savedActiveCategory && (savedActiveCategory === 'all' || data.categories.some(c => c.id == savedActiveCategory))) {
            activeCategoryId = savedActiveCategory === 'all' ? 'all' : parseInt(savedActiveCategory);
        } else {
            activeCategoryId = data.categories.length > 0 ? data.categories[0].id : 'all';
        }

        const savedAllowDragging = localStorage.getItem('allowDraggingCategories');
        if (savedAllowDragging !== null) {
            allowDraggingCategories = JSON.parse(savedAllowDragging);
        }
    }

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
            localStorage.setItem('activeCategoryId', activeCategoryId);
            localStorage.setItem('allowDraggingCategories', JSON.stringify(allowDraggingCategories));
        } catch (error) {
            console.error('Failed to save data to backend:', error);
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

    function renderCategories() {
        if (categorySortableInstance) {
            categorySortableInstance.destroy();
            categorySortableInstance = null;
            console.log("Destroyed old categorySortableInstance.");
        }

        categoryList.innerHTML = '';
        allowDraggingCheckbox.checked = allowDraggingCategories;

        const allItem = document.createElement('li');
        allItem.textContent = '全部';
        allItem.dataset.id = 'all';
        allItem.classList.add('all-category-item');
        if (activeCategoryId === 'all') {
            allItem.classList.add('active');
        }
        allItem.addEventListener('click', (e) => {
            if (e.target === allItem) {
                activeCategoryId = 'all';
                saveData();
                render();
            }
        });
        categoryList.appendChild(allItem);

        data.categories.forEach(category => {
            const li = document.createElement('li');
            li.dataset.id = category.id;
            if (allowDraggingCategories) {
                li.classList.add('draggable-category-item');
            }
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
            editBtn.innerHTML = '&#9998;';
            editBtn.title = '编辑分类';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                openModal('editCategory', category);
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'category-delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = '删除分类';
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`确定要删除分类 "${category.name}" 吗？\n这将同时删除该分类下的所有书签！`)) {
                    const categoryId = category.id;
                    data.categories = data.categories.filter(c => c.id !== categoryId);
                    data.bookmarks = data.bookmarks.filter(b => b.categoryId !== categoryId);
                    if (activeCategoryId === categoryId) {
                        activeCategoryId = 'all';
                    }
                    await saveData();
                    render();
                }
            };

            controlsDiv.appendChild(editBtn);
            controlsDiv.appendChild(deleteBtn);
            li.appendChild(nameSpan);
            li.appendChild(controlsDiv);
            categoryList.appendChild(li);
        });

        if (allowDraggingCategories) {
            categorySortableInstance = new Sortable(categoryList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                filter: '.all-category-item',
                onMove: function (evt) {
                    return !evt.related.classList.contains('all-category-item') && !evt.dragged.classList.contains('all-category-item');
                },
                onEnd: async function (evt) {
                    console.log("Sortable onEnd event fired for categories.");
                    const newOrderIds = Array.from(categoryList.children)
                                           .filter(item => item.classList.contains('draggable-category-item'))
                                           .map(item => parseInt(item.dataset.id));

                    const newCategories = newOrderIds.map(id => data.categories.find(c => c.id === id));
                    data.categories = newCategories.filter(Boolean);

                    await saveData();
                    console.log("Data saved to backend after category reorder.");
                    render();
                    console.log("UI re-rendered after category reorder.");
                },
            });
            console.log("Category Sortable instance initialized.");
        } else {
            console.log("Category dragging is disabled, Sortable not initialized.");
        }
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

                    // 根据 collapsedCategories 状态设置初始显示
                    if (data.collapsedCategories[category.id]) {
                        title.classList.add('collapsed');
                        bookmarkGroup.style.display = 'none';
                    }

                    title.addEventListener('click', async () => {
                        const isCollapsed = title.classList.toggle('collapsed');
                        bookmarkGroup.style.display = isCollapsed ? 'none' : 'grid';
                        data.collapsedCategories[category.id] = isCollapsed;
                        await saveData();
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
        editBtn.innerHTML = '&#9998;';
        editBtn.className = 'edit-btn';
        editBtn.title = '编辑书签';
        editBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openModal('editBookmark', bookmark);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = '删除书签';
        deleteBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm(`确定要删除书签 "${bookmark.name}" 吗？`)) {
                data.bookmarks = data.bookmarks.filter(b => b.id !== bookmark.id);
                await saveData();
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
                onEnd: async function () {
                    const newOrderIds = Array.from(element.children).map(item => parseInt(item.dataset.id));
                    const otherBookmarks = data.bookmarks.filter(b => b.categoryId != categoryId);
                    const newlySortedBookmarks = newOrderIds.map(id => {
                        return data.bookmarks.find(b => b.id === id);
                    });
                    data.bookmarks = [...otherBookmarks, ...newlySortedBookmarks];
                    await saveData();
                },
            });
        }
    }

    // 新增：一键展开所有分类
    async function expandAllCategories() {
        data.categories.forEach(category => {
            data.collapsedCategories[category.id] = false;
        });
        await saveData();
        render();
    }

    // 新增：一键收起所有分类
    async function collapseAllCategories() {
        data.categories.forEach(category => {
            data.collapsedCategories[category.id] = true;
        });
        await saveData();
        render();
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

    modalForm.addEventListener('submit', async (e) => {
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

        await saveData();
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

    allowDraggingCheckbox.addEventListener('change', async () => {
        allowDraggingCategories = allowDraggingCheckbox.checked;
        await saveData();
        render();
    });

    // 新增：为一键展开/收起按钮添加事件监听器
    expandAllBtn.addEventListener('click', expandAllCategories);
    collapseAllBtn.addEventListener('click', collapseAllCategories);

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
                reader.onload = async (event) => {
                    try {
                        const importedData = JSON.parse(event.target.result);
                        if (importedData.categories && importedData.bookmarks) {
                            if (confirm('这将覆盖您当前的所有数据，确定要导入吗？')) {
                                data = { ...importedData, collapsedCategories: importedData.collapsedCategories || {} };
                                activeCategoryId = data.categories.length > 0 ? data.categories[0].id : 'all';
                                if (importedData.allowDraggingCategories !== undefined) {
                                    allowDraggingCategories = importedData.allowDraggingCategories;
                                }
                                await saveData();
                                render();
                                alert('数据导入成功！');
                            }
                        } else {
                            alert('文件格式无效！');
                        }
                    } catch (err) {
                        alert('导入文件解析失败，请确保它是有效的 JSON 格式。');
                        console.error('Error parsing imported data:', err);
                    }
                };
                reader.readAsText(file);
            }
        };
        fileInput.click();
    });

    await loadData();
    try {
        render();
    } catch (e) {
        console.error("Error during initial render:", e);
        alert("初始化页面时发生错误，请检查控制台。");
    }
});
