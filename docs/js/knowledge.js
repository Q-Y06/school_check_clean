class KnowledgeQueryPage {
  constructor() {
    this.currentUser = null;
    this.knowledge = [];
    this.filtered = [];
    this.activeTag = '';
    this.activeDeviceType = '';
    this.pageSize = 10;
    this.currentPage = 1;
    this.activeDetailItem = null;
    this.commentPage = 1;
    this.commentPageSize = 10;
    this.commentPageData = null;
    this.replyTarget = null;
    this.editingCommentId = null;
    this.init();
  }

  async init() {
    this.currentUser = this.getCurrentUser();
    if (!this.currentUser) return;
    this.currentUser = await this.syncCurrentUser();
    if (!this.currentUser) return;

    this.ensureReplyBox();
    this.renderUser();
    this.bindEvents();
    await this.loadKnowledge();
    this.render();
  }

  ensureReplyBox() {
    const form = document.getElementById('commentForm');
    const textarea = document.getElementById('commentInput');
    if (!form || !textarea || document.getElementById('replyState')) return;

    const reply = document.createElement('div');
    reply.id = 'replyState';
    reply.className = 'reply-state';
    reply.style.display = 'none';
    reply.innerHTML = [
      '<span id="replyStateText"></span>',
      '<div class="reply-state-actions">',
      '  <button type="button" id="replyCancelBtn" class="reply-cancel-btn">取消</button>',
      '</div>'
    ].join('');
    form.insertBefore(reply, textarea);
  }

  getCurrentUser() {
    const raw = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!raw || !token) {
      window.location.href = 'login.html';
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = 'login.html';
      return null;
    }
  }

  async syncCurrentUser() {
    try {
      const me = await ApiClient.get('/api/auth/me');
      if (Number(me.status) !== 1) {
        this.logout();
        return null;
      }
      const merged = Object.assign({}, this.currentUser || {}, me);
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    } catch {
      this.logout();
      return null;
    }
  }

  async loadKnowledge() {
    const page = await ApiClient.get('/api/knowledge/list?pageNum=1&pageSize=500');
    this.knowledge = (page?.records || []).sort((a, b) => new Date(b.updateTime || b.createTime || 0) - new Date(a.updateTime || a.createTime || 0));
  }

  bindEvents() {
    document.getElementById('refreshBtn')?.addEventListener('click', async () => {
      await this.loadKnowledge();
      this.currentPage = 1;
      this.render();
    });

    document.getElementById('resetBtn')?.addEventListener('click', () => {
      const keywordInput = document.getElementById('keywordInput');
      const tagFilter = document.getElementById('tagFilter');
      const deviceTypeFilter = document.getElementById('deviceTypeFilter');
      if (keywordInput) keywordInput.value = '';
      if (tagFilter) tagFilter.value = '';
      if (deviceTypeFilter) deviceTypeFilter.value = '';
      this.activeTag = '';
      this.activeDeviceType = '';
      this.currentPage = 1;
      this.render();
    });

    document.getElementById('keywordInput')?.addEventListener('input', () => {
      this.currentPage = 1;
      this.render();
    });

    document.getElementById('tagFilter')?.addEventListener('change', (e) => {
      this.activeTag = e.target.value || '';
      this.currentPage = 1;
      this.render();
    });

    document.getElementById('deviceTypeFilter')?.addEventListener('change', (e) => {
      this.activeDeviceType = e.target.value || '';
      this.currentPage = 1;
      this.render();
    });

    document.getElementById('detailClose')?.addEventListener('click', () => this.closeDetail());
    document.getElementById('detailModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'detailModal') this.closeDetail();
    });

    document.getElementById('uploadBtn')?.addEventListener('click', () => this.openUploadModal());
    document.getElementById('uploadClose')?.addEventListener('click', () => this.closeUploadModal());
    document.getElementById('uploadCancel')?.addEventListener('click', () => this.closeUploadModal());
    document.getElementById('uploadModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'uploadModal') this.closeUploadModal();
    });

    document.getElementById('knowledgeUploadForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitKnowledge(e.target);
    });

    document.getElementById('commentForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitComment();
    });

    document.getElementById('replyCancelBtn')?.addEventListener('click', () => {
      this.clearReplyTarget();
      this.clearEditingState();
    });

    document.getElementById('detailComments')?.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('[data-delete-comment-id]');
      if (deleteBtn) {
        await this.deleteComment(deleteBtn.dataset.deleteCommentId);
        return;
      }

      const replyBtn = e.target.closest('[data-reply-comment-id]');
      if (replyBtn) {
        this.clearEditingState();
        this.setReplyTarget(replyBtn.dataset.replyCommentId, replyBtn.dataset.replyUserName || '该用户');
        return;
      }

      const pinBtn = e.target.closest('[data-pin-comment-id]');
      if (pinBtn) {
        await this.togglePinComment(pinBtn.dataset.pinCommentId, pinBtn.dataset.pinValue === '1');
        return;
      }

      const featureBtn = e.target.closest('[data-feature-comment-id]');
      if (featureBtn) {
        await this.toggleFeatureComment(featureBtn.dataset.featureCommentId, featureBtn.dataset.featureValue === '1');
        return;
      }

      const editBtn = e.target.closest('[data-edit-comment-id]');
      if (editBtn) {
        const comment = this.findCommentById(editBtn.dataset.editCommentId);
        if (comment) {
          this.clearReplyTarget();
          this.startEditingComment(comment);
        }
      }
    });
  }

  renderUser() {
    const name = this.currentUser.fullName || this.currentUser.username || '用户';
    const role = String(this.currentUser.role || '').toLowerCase() === 'admin' ? '系统管理员' : '知识库查询用户';
    const avatar = name.charAt(0).toUpperCase();
    document.getElementById('userName').textContent = name;
    document.getElementById('userRole').textContent = role;
    document.getElementById('userAvatar').textContent = avatar;
  }

  render() {
    this.renderTagFilters();
    this.renderDeviceTypeFilters();
    this.applyFilters();
    this.renderList();
    this.renderPagination();
  }

  renderTagFilters() {
    const tags = Array.from(new Set(this.knowledge.flatMap((item) => this.tags(item.tags)))).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const tagFilter = document.getElementById('tagFilter');
    tagFilter.innerHTML = '<option value="">全部标签</option>' + tags.map((tag) => `<option value="${this.escapeHtml(tag)}" ${tag === this.activeTag ? 'selected' : ''}>${this.escapeHtml(tag)}</option>`).join('');

    const tagList = document.getElementById('tagList');
    const buttons = ['<button class="tag-btn ' + (!this.activeTag ? 'active' : '') + '" data-tag="">全部</button>']
      .concat(tags.map((tag) => `<button class="tag-btn ${tag === this.activeTag ? 'active' : ''}" data-tag="${this.escapeHtml(tag)}">${this.escapeHtml(tag)}</button>`));
    tagList.innerHTML = buttons.join('');

    tagList.querySelectorAll('[data-tag]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTag = btn.dataset.tag || '';
        tagFilter.value = this.activeTag;
        this.currentPage = 1;
        this.render();
      });
    });
  }

  renderDeviceTypeFilters() {
    const types = Array.from(new Set(this.knowledge.map((item) => String(item.deviceType || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const deviceTypeFilter = document.getElementById('deviceTypeFilter');
    deviceTypeFilter.innerHTML = '<option value="">全部设备类型</option>' + types.map((type) => `<option value="${this.escapeHtml(type)}" ${type === this.activeDeviceType ? 'selected' : ''}>${this.escapeHtml(type)}</option>`).join('');

    const typeList = document.getElementById('typeList');
    const buttons = ['<button class="type-btn ' + (!this.activeDeviceType ? 'active' : '') + '" data-type="">全部</button>']
      .concat(types.map((type) => `<button class="type-btn ${type === this.activeDeviceType ? 'active' : ''}" data-type="${this.escapeHtml(type)}">${this.escapeHtml(type)}</button>`));
    typeList.innerHTML = buttons.join('');

    typeList.querySelectorAll('[data-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeDeviceType = btn.dataset.type || '';
        deviceTypeFilter.value = this.activeDeviceType;
        this.currentPage = 1;
        this.render();
      });
    });
  }

  applyFilters() {
    const keyword = (document.getElementById('keywordInput')?.value || '').trim().toLowerCase();
    this.filtered = this.knowledge.filter((item) => {
      const haystack = `${item.title || ''} ${item.tags || ''} ${item.content || ''} ${item.deviceType || ''} ${item.type || ''}`.toLowerCase();
      const hitKeyword = !keyword || haystack.includes(keyword);
      const hitTag = !this.activeTag || this.tags(item.tags).includes(this.activeTag);
      const hitDeviceType = !this.activeDeviceType || String(item.deviceType || '').trim() === this.activeDeviceType;
      return hitKeyword && hitTag && hitDeviceType;
    });
  }

  renderList() {
    const listEl = document.getElementById('knowledgeList');
    const emptyEl = document.getElementById('emptyState');
    const summaryEl = document.getElementById('resultSummary');
    summaryEl.textContent = `共 ${this.filtered.length} 条知识记录`;

    if (!this.filtered.length) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';
    const start = (this.currentPage - 1) * this.pageSize;
    const pageItems = this.filtered.slice(start, start + this.pageSize);

    listEl.innerHTML = pageItems.map((item) => {
      const tags = this.tags(item.tags);
      return `
        <article class="knowledge-item">
          <div class="knowledge-top">
            <div>
              <h3 class="knowledge-title">${this.escapeHtml(item.title || '未命名知识')}</h3>
              <div class="knowledge-meta">设备类型：${this.escapeHtml(item.deviceType || '未分类')} · 创建人：${this.escapeHtml(item.createUserName || item.creatorName || '未知')} · 维护时间：${this.formatTime(item.updateTime || item.createTime)}</div>
            </div>
            <span class="knowledge-type">${this.escapeHtml(item.type || '通用故障')}</span>
          </div>
          <div class="knowledge-tags">${tags.length ? tags.map((tag) => `<span class="knowledge-tag">${this.escapeHtml(tag)}</span>`).join('') : '<span class="knowledge-tag">无标签</span>'}</div>
          <div class="knowledge-content">${this.escapeHtml(item.content || '暂无内容')}</div>
          <div class="knowledge-footer">
            <span class="comment-count"><i class="fas fa-comments"></i> 留言 ${Number(item.commentCount || 0)} 条</span>
            <button class="detail-btn" type="button" data-id="${item.id}">留言</button>
          </div>
        </article>`;
    }).join('');

    listEl.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = this.filtered.find((row) => String(row.id) === String(btn.dataset.id));
        if (item) await this.openDetail(item);
      });
    });
  }

  renderPagination() {
    const container = document.getElementById('knowledgePagination');
    if (!container) return;
    const total = Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
    if (!this.filtered.length || total <= 1) {
      container.innerHTML = '';
      return;
    }
    if (this.currentPage > total) this.currentPage = total;
    container.innerHTML = `
      <button class="page-btn" type="button" data-page="prev" ${this.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="page-info">第 ${this.currentPage} / ${total} 页，共 ${this.filtered.length} 条</span>
      <button class="page-btn" type="button" data-page="next" ${this.currentPage >= total ? 'disabled' : ''}>下一页</button>
    `;
    container.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.page === 'prev' && this.currentPage > 1) this.currentPage -= 1;
        if (btn.dataset.page === 'next' && this.currentPage < total) this.currentPage += 1;
        this.renderList();
        this.renderPagination();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  async openDetail(item) {
    const modal = document.getElementById('detailModal');
    const titleEl = document.getElementById('detailTitle');
    const metaEl = document.getElementById('detailMeta');
    const tagsEl = document.getElementById('detailTags');
    const contentEl = document.getElementById('detailContent');
    const tags = this.tags(item.tags);

    this.activeDetailItem = item;
    this.commentPage = 1;
    this.editingCommentId = null;
    this.replyTarget = null;
    titleEl.textContent = item.title || '未命名知识';
    metaEl.textContent = `设备类型：${item.deviceType || '未分类'} | 故障分类：${item.type || '通用故障'} | 创建人：${item.createUserName || item.creatorName || '未知'} | 维护时间：${this.formatTime(item.updateTime || item.createTime)}`;
    tagsEl.innerHTML = tags.length ? tags.map((tag) => `<span class="knowledge-tag">${this.escapeHtml(tag)}</span>`).join('') : '<span class="knowledge-tag">无标签</span>';
    contentEl.textContent = item.content || '暂无内容';
    document.getElementById('commentInput').value = '';
    this.clearReplyTarget();
    this.clearEditingState();
    await this.loadComments();
    modal.classList.add('active');
  }

  closeDetail() {
    this.activeDetailItem = null;
    this.commentPage = 1;
    this.commentPageData = null;
    this.clearReplyTarget();
    this.clearEditingState();
    document.getElementById('commentInput').value = '';
    document.getElementById('detailModal')?.classList.remove('active');
  }

  async loadComments() {
    if (!this.activeDetailItem?.id) return;
    const page = await ApiClient.get(`/api/knowledge/${this.activeDetailItem.id}/comments?pageNum=${this.commentPage}&pageSize=${this.commentPageSize}`);
    this.commentPageData = page || { records: [], total: 0, current: 1, pages: 1 };
    this.renderComments();
  }

  renderComments() {
    const listEl = document.getElementById('detailComments');
    const summaryEl = document.getElementById('commentSummary');
    const pageEl = document.getElementById('commentPagination');
    const records = this.commentPageData?.records || [];
    const total = Number(this.commentPageData?.total || 0);
    const current = Number(this.commentPageData?.current || this.commentPage || 1);
    const pages = Number(this.commentPageData?.pages || 1);

    if (summaryEl) {
      summaryEl.textContent = total ? `共 ${total} 条留言` : '暂无留言';
    }

    if (!records.length) {
      listEl.innerHTML = '<div class="comment-empty">还没有留言，欢迎补充经验、提问或回复他人。</div>';
    } else {
      listEl.innerHTML = this.buildCommentThreads(records);
    }

    if (!pageEl) return;
    if (!total || pages <= 1) {
      pageEl.innerHTML = '';
      return;
    }
    pageEl.innerHTML = `
      <button class="page-btn" type="button" data-page="prev" ${current <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="page-info">第 ${current} / ${pages} 页，共 ${total} 条留言</span>
      <button class="page-btn" type="button" data-page="next" ${current >= pages ? 'disabled' : ''}>下一页</button>
    `;
    pageEl.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.page === 'prev' && this.commentPage > 1) this.commentPage -= 1;
        if (btn.dataset.page === 'next' && this.commentPage < pages) this.commentPage += 1;
        await this.loadComments();
      });
    });
  }

  buildCommentThreads(records) {
    const parentComments = [];
    const childMap = new Map();
    const childOnly = [];
    const parentIds = new Set(records.filter((item) => !item.parentId).map((item) => String(item.id)));

    records.forEach((comment) => {
      if (comment.parentId && parentIds.has(String(comment.parentId))) {
        const key = String(comment.parentId);
        if (!childMap.has(key)) childMap.set(key, []);
        childMap.get(key).push(comment);
      } else if (comment.parentId) {
        childOnly.push(comment);
      } else {
        parentComments.push(comment);
      }
    });

    const threadHtml = parentComments.map((comment) => {
      const replies = childMap.get(String(comment.id)) || [];
      return `
        <div class="comment-thread">
          ${this.renderSingleComment(comment, false)}
          ${replies.length ? `<div class="comment-replies">${replies.map((reply) => this.renderSingleComment(reply, true)).join('')}</div>` : ''}
        </div>
      `;
    }).join('');

    const orphanHtml = childOnly.length ? `<div class="comment-orphan-list">${childOnly.map((reply) => this.renderSingleComment(reply, true)).join('')}</div>` : '';
    return threadHtml + orphanHtml;
  }

  renderSingleComment(comment, isReply) {
    const pinned = Number(comment.pinned || 0) === 1;
    const featured = Number(comment.featured || 0) === 1;
    return `
      <article class="comment-item ${pinned ? 'comment-item-pinned' : ''} ${featured ? 'comment-item-featured' : ''} ${isReply ? 'comment-item-reply' : ''}">
        <div class="comment-meta">
          <div class="comment-meta-left">
            <strong>${this.escapeHtml(comment.userName || '用户')}</strong>
            <span>${this.formatTime(comment.createTime)}</span>
            ${pinned ? '<span class="comment-pin-badge">置顶</span>' : ''}
            ${featured ? '<span class="comment-featured-badge">精选</span>' : ''}
          </div>
          <div class="comment-meta-actions">
            <button type="button" class="comment-reply-btn" data-reply-comment-id="${comment.id}" data-reply-user-name="${this.escapeHtml(comment.userName || '该用户')}">回复</button>
            ${this.canEditComment(comment) ? `<button type="button" class="comment-edit-btn" data-edit-comment-id="${comment.id}">编辑</button>` : ''}
            ${this.canPinComment() ? `<button type="button" class="comment-pin-btn" data-pin-comment-id="${comment.id}" data-pin-value="${pinned ? '0' : '1'}">${pinned ? '取消置顶' : '置顶'}</button>` : ''}
            ${this.canFeatureComment() ? `<button type="button" class="comment-feature-btn" data-feature-comment-id="${comment.id}" data-feature-value="${featured ? '0' : '1'}">${featured ? '取消精选' : '精选'}</button>` : ''}
            ${this.canDeleteComment(comment) ? `<button type="button" class="comment-delete-btn" data-delete-comment-id="${comment.id}">删除</button>` : ''}
          </div>
        </div>
        ${comment.replyToUserName ? `<div class="reply-to-line">回复 <span>@${this.escapeHtml(comment.replyToUserName)}</span></div>` : ''}
        <div class="comment-content">${this.formatCommentContent(comment.content || '')}</div>
      </article>
    `;
  }

  openUploadModal() {
    document.getElementById('knowledgeUploadForm')?.reset();
    document.getElementById('uploadModal')?.classList.add('active');
  }

  closeUploadModal() {
    document.getElementById('uploadModal')?.classList.remove('active');
  }

  async submitKnowledge(form) {
    const fd = new FormData(form);
    const payload = {
      title: String(fd.get('title') || '').trim(),
      deviceType: String(fd.get('deviceType') || '服务器').trim(),
      type: String(fd.get('type') || '通用故障').trim(),
      tags: this.tags(fd.get('tags') || '').join(','),
      content: String(fd.get('content') || '').trim(),
      createUserId: this.currentUser.id || this.currentUser.userId || null,
      createUserName: this.currentUser.fullName || this.currentUser.username || '用户',
      creatorId: this.currentUser.id || this.currentUser.userId || null,
      creatorName: this.currentUser.fullName || this.currentUser.username || '用户',
      attachmentPath: ''
    };

    if (!payload.title || !payload.content) {
      alert('请填写完整的知识标题和知识内容');
      return;
    }

    try {
      await ApiClient.postJson('/api/knowledge', payload);
      this.closeUploadModal();
      await this.loadKnowledge();
      this.currentPage = 1;
      this.render();
      alert('知识上传成功');
    } catch (error) {
      alert(error.message || '知识上传失败');
    }
  }

  async submitComment() {
    if (!this.activeDetailItem?.id) return;
    const input = document.getElementById('commentInput');
    const content = String(input?.value || '').trim();
    if (!content) {
      alert('请输入留言内容');
      return;
    }

    try {
      if (this.editingCommentId) {
        await ApiClient.putJson(`/api/knowledge/${this.activeDetailItem.id}/comments/${this.editingCommentId}`, { content });
      } else {
        const payload = { content };
        if (this.replyTarget) {
          payload.parentId = this.replyTarget.id;
          payload.replyToUserName = this.replyTarget.userName;
        }
        await ApiClient.postJson(`/api/knowledge/${this.activeDetailItem.id}/comments`, payload);
      }

      input.value = '';
      this.clearReplyTarget();
      this.clearEditingState();
      await this.loadKnowledge();
      const updated = this.knowledge.find((item) => String(item.id) === String(this.activeDetailItem.id));
      if (updated) this.activeDetailItem = updated;
      this.render();
      this.commentPage = 1;
      await this.loadComments();
    } catch (error) {
      alert(error.message || (this.editingCommentId ? '留言更新失败' : '留言发布失败'));
    }
  }

  async deleteComment(commentId) {
    if (!this.activeDetailItem?.id || !commentId) return;
    if (!window.confirm('确定删除这条留言吗？')) return;

    try {
      await ApiClient.request(`/api/knowledge/${this.activeDetailItem.id}/comments/${commentId}`, { method: 'DELETE' });
      this.clearReplyTarget();
      if (String(this.editingCommentId || '') === String(commentId)) {
        this.clearEditingState();
      }
      await this.loadKnowledge();
      const updated = this.knowledge.find((item) => String(item.id) === String(this.activeDetailItem.id));
      if (updated) this.activeDetailItem = updated;
      this.render();
      const totalAfter = Math.max(0, Number(updated?.commentCount || 0));
      const pagesAfter = Math.max(1, Math.ceil(totalAfter / this.commentPageSize));
      if (this.commentPage > pagesAfter) this.commentPage = pagesAfter;
      await this.loadComments();
    } catch (error) {
      alert(error.message || '留言删除失败');
    }
  }

  async togglePinComment(commentId, shouldPin) {
    if (!this.activeDetailItem?.id || !commentId) return;
    try {
      await ApiClient.request(`/api/knowledge/${this.activeDetailItem.id}/comments/${commentId}/pin?value=${shouldPin}`, {
        method: 'PUT'
      });
      await this.loadComments();
    } catch (error) {
      alert(error.message || '留言状态更新失败');
    }
  }

  async toggleFeatureComment(commentId, shouldFeature) {
    if (!this.activeDetailItem?.id || !commentId) return;
    try {
      await ApiClient.request(`/api/knowledge/${this.activeDetailItem.id}/comments/${commentId}/feature?value=${shouldFeature}`, {
        method: 'PUT'
      });
      await this.loadComments();
    } catch (error) {
      alert(error.message || '精选状态更新失败');
    }
  }

  startEditingComment(comment) {
    this.editingCommentId = Number(comment.id);
    const input = document.getElementById('commentInput');
    if (input) {
      input.value = comment.content || '';
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    const box = document.getElementById('replyState');
    const text = document.getElementById('replyStateText');
    if (box && text) {
      text.textContent = '正在编辑留言';
      box.style.display = 'flex';
    }
  }

  clearEditingState() {
    this.editingCommentId = null;
    if (!this.replyTarget) {
      const box = document.getElementById('replyState');
      if (box) box.style.display = 'none';
    }
  }

  setReplyTarget(commentId, userName) {
    this.replyTarget = { id: Number(commentId), userName };
    const box = document.getElementById('replyState');
    const text = document.getElementById('replyStateText');
    if (box && text) {
      text.textContent = `正在回复 @${userName}`;
      box.style.display = 'flex';
    }
    document.getElementById('commentInput')?.focus();
  }

  clearReplyTarget() {
    this.replyTarget = null;
    const box = document.getElementById('replyState');
    if (box && !this.editingCommentId) box.style.display = 'none';
  }

  findCommentById(commentId) {
    const records = this.commentPageData?.records || [];
    return records.find((item) => String(item.id) === String(commentId)) || null;
  }

  canDeleteComment(comment) {
    const role = String(this.currentUser?.role || '').toLowerCase();
    const currentUserId = String(this.currentUser?.userId || this.currentUser?.id || '');
    return role === 'admin' || currentUserId === String(comment.userId || '');
  }

  canEditComment(comment) {
    const currentUserId = String(this.currentUser?.userId || this.currentUser?.id || '');
    return currentUserId === String(comment.userId || '');
  }

  canPinComment() {
    return String(this.currentUser?.role || '').toLowerCase() === 'admin';
  }

  canFeatureComment() {
    return String(this.currentUser?.role || '').toLowerCase() === 'admin';
  }

  formatCommentContent(value) {
    const escaped = this.escapeHtml(value).replace(/\n/g, '<br>');
    return escaped.replace(/(^|\s)(@[\u4e00-\u9fa5A-Za-z0-9_-]+)/g, '$1<span class="mention-highlight">$2</span>');
  }

  tags(value) {
    return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  formatTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${week} ${hh}:${mm}`;
  }

  escapeHtml(value) {
    const text = String(value ?? '');
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.knowledgeQueryPage = new KnowledgeQueryPage();
});