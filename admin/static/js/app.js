// ========================================
// API 中转服务 - 管理面板 JavaScript
// ========================================

// 全局变量
let sessionToken = '';
let currentPage = 'dashboard';
let logsOffset = 0;
let logsLimit = 50;
let allKeys = [];
let allModels = {};

// 国际化支持
let currentLang = localStorage.getItem('preferredLanguage') || 'zh';

const i18n = {
    zh: {
        // Top bar
        service_running: '服务运行中',
        logout: '退出登录',
        login: '登录',
        logging_in: '登录中...',
        synced: '已同步',
        not_synced: '未同步',
        input_password: '请输入密码',
        // Common
        name: '名称',
        api_key: 'API Key',
        status: '状态',
        operations: '操作',
        success: '成功',
        error: '错误',
        warning: '警告',
        no_data: '暂无数据',
        // Sections
        request_logs: '请求日志',
        export_logs: '导出日志',
        clear_logs: '清空日志',
        // Source API
        test_source: '测试',
        testing: '测试中...',
        test_success: '测试成功',
        test_failed: '测试失败',
        confirm_test: '确定要测试此源API连接吗？',
        add_source_api: '添加源API',
        edit_source_api: '编辑源API配置',
        // Keys
        key_management: '密钥管理',
        create_key: '创建密钥',
        key_name: '密钥名称',
        rate_limit: '限流',
        req_per_min: '请求/分钟',
        created_at: '创建时间',
        expires_at: '过期时间',
        usage_stats: '查看统计',
        edit: '编辑',
        enable: '启用',
        disable: '禁用',
        delete: '删除',
        // Models
        model_config: '模型配置',
        source_api_config: '源API配置',
        virtual_model_id: '虚拟模型ID',
        binding_relationship: '绑定关系',
        create_model_id: '创建模型ID',
        create_binding: '创建绑定',
        // Dashboard
        dashboard: '仪表板',
        refresh: '刷新',
        today_requests: '今日请求',
        today_tokens: '今日 Token',
        active_keys: '活跃密钥',
        error_rate: '错误率',
        realtime_monitor: '实时监控',
        top_users_today: '今日活跃用户',
        top_models: '热门模型排行',
        active: '活跃',
        normal: '正常',
        // Logs
        filter: '筛选',
        reset: '重置',
        key_id: '密钥 ID',
        model: '模型',
        status_code: '状态码',
        start_date: '开始日期',
        end_date: '结束日期',
        client_ip: '客户端 IP',
        input_output_tokens: '输入/输出 Token',
        response_time: '响应时间',
        error_message: '错误信息',
        // Stats
        stats_report: '统计报表',
        query: '查询',
        total_requests: '总请求数',
        total_input_tokens: '总输入 Token',
        total_output_tokens: '总输出 Token',
        total_errors: '总错误数',
        total_tokens: '总 Token',
        avg_req_per_user: '平均请求/用户',
        by_date: '按日期统计',
        by_user: '按用户统计',
        date: '日期',
        request_count: '请求数',
        // Settings
        settings: '系统设置',
        rate_limit_config: '限流配置',
        global_rpm: '全局限流（请求/分钟）',
        default_key_rpm: '默认密钥限流（请求/分钟）',
        save_rate_limit: '保存限流配置',
        security_settings: '安全设置',
        new_admin_password: '新管理员密码',
        change_password: '修改密码',
        service_info: '服务信息',
        service_status: '服务状态',
        running: '运行中',
        listen_address: '监听地址',
        api_version: 'API 版本',
        data_cleanup: '⚠️ 数据清理',
        warning_text: '以下操作不可撤销，请谨慎使用！',
        clear_request_logs: '清理请求日志',
        clear_stats: '清理统计数据',
        clear_disabled_keys: '清理禁用密钥',
        clear_orphan_logs: '清理孤立日志',
        db_backup: '数据库备份与恢复',
        backup_reminder: '定期备份数据以防丢失',
        create_backup: '创建备份',
        export_db: '导出数据库',
        import_db: '导入数据库',
        privacy_filter_settings: '隐私过滤设置',
        enable_privacy_filter: '启用隐私过滤',
        filter_hint: '过滤源API返回的敏感信息（如提供商详情、元数据等）',
        filter_metadata: '过滤元数据（ID、创建时间等）',
        filter_usage_details: '过滤使用详情（仅保留基本token统计）',
        filter_provider_info: '过滤提供商信息',
        filter_error_details: '过滤错误详情（使用自定义错误消息）',
        // Lang names
        lang_name_zh: '中文',
        lang_name_en: 'English',
        // Modal
        confirm_password: '确认修改密码',
        confirm_password_hint: '修改密码是敏感操作，请输入当前管理员密码确认身份。',
        current_password: '当前密码',
        new_password: '新密码',
        confirm_change: '确认修改',
        cancel: '取消',
        save: '保存',
        // Forms
        placeholder_name: '例如：生产环境密钥',
        placeholder_description: '可选描述信息',
        remarks: '备注说明',
        expiry: '过期时间',
        permanent: '永久',
        activated: '激活',
        disabled: '禁用',
        no_keys_yet: '暂无密钥，请创建新密钥',
        no_sources_yet: '暂无源API配置',
        no_virtual_models_yet: '暂无虚拟模型',
        no_bindings_yet: '暂无绑定关系',
        no_logs_yet: '暂无日志记录',
        // Confirmations
        confirm_delete_key: '确定要删除此密钥吗？删除后无法恢复。',
        confirm_delete_source: '删除源API会同时删除相关的绑定关系，确定继续吗？',
        confirm_delete_vm: '删除虚拟模型会同时删除相关的绑定关系，确定继续吗？',
        confirm_delete_binding: '确定要删除这个绑定关系吗？',
        confirm_clear_logs: '确定要清空所有日志和统计数据吗？此操作不可恢复。',
        confirm_cleanup_all: '⚠️ 警告：您即将清理所有数据，此操作不可恢复！\n\n确定要继续吗？',
        confirm_cleanup_cond: '确认清理以下条件：\n\n此操作不可恢复，确定继续吗？',
        confirm_import: '⚠️ 警告：导入数据库将覆盖现有数据，此操作不可恢复！\n\n确定要继续吗？',
        confirm_delete_disabled_keys: '确定要删除所有禁用的密钥吗？此操作不可恢复。',
        confirm_delete_orphan_logs: '确定要清理孤立的日志记录吗？\n\n孤立日志指密钥已被删除但仍存在的日志记录。',
        // Toasts
        logs_exported: '日志已导出',
        export_failed: '导出失败',
        filter_applied: '筛选已应用',
        key_created: '密钥创建成功！',
        key_deleted: '密钥已删除',
        key_updated: '配置已更新',
        key_enabled: '密钥已启用',
        key_disabled: '密钥已禁用',
        source_created: '源API创建成功',
        source_updated: '源API更新成功',
        source_deleted: '源API已删除',
        vm_created: '虚拟模型创建成功',
        vm_deleted: '虚拟模型已删除',
        binding_created: '绑定创建成功',
        binding_updated: '绑定更新成功',
        binding_deleted: '绑定关系已删除',
        rate_limit_saved: '限流配置已保存',
        password_changed: '密码已修改',
        privacy_saved: '隐私过滤设置已保存',
        backup_success: '备份成功！',
        export_success: '数据库导出成功',
        import_success: '数据库导入成功，正在刷新...',
        cleanup_success: '成功清理 {count} 条记录',
        no_disabled_keys: '没有禁用的密钥需要删除',
        no_orphan_logs: '没有孤立日志需要清理',
        // Placeholders
        ph_key_id: '筛选密钥',
        ph_model: '筛选模型',
        ph_key_id_stats: '留空查看全部',
        ph_key_name: '例如：生产环境密钥',
        ph_description: '可选描述信息',
        ph_new_password: '输入新密码',
        input_password: '请输入密码',
        // Table headers
        key_id_header: '密钥 ID',
        created_at: '创建时间',
        expires_at: '过期时间',
        rate_limit_header: '限流',
        usage_stats_header: '使用统计',
        operations_header: '操作',
        // Stats
        today_input_tokens: '今日输入 Token',
        today_output_tokens: '今日输出 Token',
        input_output_ratio: '输入/输出比',
        avg_response_time: '平均响应时间',
        active_ips: '活跃IP数',
        requests_last_min: '最近1分钟请求数',
        active_requests: '活跃请求',
        requests_last_5min: '最近5分钟请求速率',
        req_per_min: '请求/分钟',
        last_5min: '最近5分钟',
        top_users_today: '今日活跃用户',
        top_models: '热门模型排行',
        user: '用户',
        request_count: '请求数',
        token_usage: 'Token 消耗',
        avg_response: '平均响应',
        by_date: '按日期统计',
        by_user: '按用户统计',
        // Forms
        key_name_req: '密钥名称 *',
        rate_limit_rpm: '限流（请求/分钟）',
        expiry: '过期时间',
        remarks: '备注说明',
        rate_limit_config: '限流配置',
        global_rpm: '全局限流（请求/分钟）',
        default_key_rpm: '默认密钥限流（请求/分钟）',
        security_settings: '安全设置',
        new_admin_password_label: '新管理员密码',
        service_info: '服务信息',
        service_status: '服务状态',
        running: '运行中',
        listen_address: '监听地址',
        api_version_label: 'API 版本',
        data_cleanup: '⚠️ 数据清理',
        warning_text: '以下操作不可撤销，请谨慎使用！',
        // Realtime
        realtime_monitor: '实时监控',
        // New keys
        key_detail: '密钥详情',
        copy: '复制',
        edit_key_config: '编辑密钥配置',
        model_config_three_steps: '模型配置（三步管理）',
        source_api_step1: '① 源API配置',
        virtual_model_step2: '② 虚拟模型ID',
        binding_step3: '③ 绑定关系',
        time: '时间',
        key: '密钥',
        prev_page: '上一页',
        next_page: '下一页',
        page_num: '第 {n} 页',
        description: '描述',
        model_id: '模型ID',
        virtual_model: '虚拟模型',
        source_api: '源API',
        source_model: '源模型',
        priority: '优先级',
        name_required: '名称 *',
        base_url_required: 'Base URL *',
        api_key_required: 'API Key *',
        create_virtual_model: '创建虚拟模型ID',
        create_binding: '创建绑定关系',
        update_binding: '更新绑定关系（换绑）',
        cleanup_key_id: '密钥 ID（可选）',
        cleanup_model: '模型（可选）',
        cleanup_start_date: '起始日期（可选）',
        cleanup_end_date: '结束日期（可选）',
        cleanup_status_filter: '状态过滤（可选）',
        no_filter: '不过滤',
        success_requests: '成功请求',
        error_requests: '错误请求',
        cleanup_warning_logs: '⚠️ 警告：此操作将永久删除符合条件的日志记录，无法恢复！',
        cleanup_warning_stats: '⚠️ 警告：此操作将永久删除符合条件的统计数据，无法恢复！',
        confirm_cleanup: '确认清理',
        cleanup_stats_title: '清理统计数据',
        cleanup_logs_title: '清理请求日志',
        api_relay_service: 'API 中转服务',
        copyright: 'Copyright © 2026 PLXT',
        base_url: 'Base URL',
        input_token: '输入 Token',
        output_token: '输出 Token',
        error_count: '错误数',
        key_not_found: '密钥不存在',
        copy_failed: '复制失败',
        browser_no_copy: '浏览器不支持复制',
        key_copied: '密钥已复制到剪贴板',
        select_virtual_model: '选择虚拟模型',
        select_source_api: '选择源API',
        select_source_model: '选择源模型',
        or_manual_input: '或手动输入',
        manual_input_label: '-- 手动输入 --',
        manual_input_placeholder: '手动输入源模型名称',
        select_or_input_model: '请选择或输入源模型名称',
        select_or_input_model_error: '请选择或输入源模型名称',
        binding_created_success: '绑定创建成功',
        binding_updated_success: '绑定更新成功',
        binding_deleted_success: '绑定关系已删除',
        binding_not_active: '激活',
        binding_inactive: '禁用',
        no_bindings_yet: '暂无绑定关系',
        create_failed: '创建失败',
        update_failed: '更新失败',
        unauthorized: '未授权，请重新登录',
        session_invalid: '会话无效，请重新登录',
        request_failed: '请求失败',
        network_error: '网络错误',
        password_min_length: '密码长度至少为 6 位',
        please_enter_current_password: '请输入当前密码',
        current_password_wrong: '当前密码错误',
        password_change_failed: '密码修改失败',
        unknown_error: '未知错误',
        cleanup_failed: '清理失败',
        select_zip: '请选择.zip格式的备份文件',
        no_key_data: '无密钥数据',
        browser_no_support: '浏览器不支持',
        key_copied_short: '密钥已复制',
        models_suffix: '个模型',
        source_model_label: '源模型:',
        api_key_label: 'API Key:',
        base_url_label: 'Base URL:',
        model_enabled: '已启用',
        model_disabled: '已禁用',
        add_first_model: '添加第一个模型',
        model_config_saved: '模型配置已保存',
        model_deleted: '模型已删除',
        key_disabled_status: '已禁用',
        key_active_status: '活跃',
        permanent_status: '永久',
        view_stats_btn: '查看统计',
        key_name_label: '密钥名称',
        key_id_label: '密钥 ID',
        created_at_label: '创建时间',
        expires_at_label: '过期时间',
        rate_limit_label: '限流',
        req_per_min_label: '请求/分钟',
        status_label: '状态',
        remarks_label: '备注说明',
        close_btn: '关闭',
        total_requests_label: '总请求数',
        total_token_label: '总 Token',
        input_token_label: '输入 Token',
        output_token_label: '输出 Token',
        key_stats_title: '密钥统计',
        cleanup_summary_prefix: '确认清理以下条件：',
        cleanup_all_warning: '⚠️ 警告：您即将清理所有请求日志，此操作不可恢复！',
        cleanup_all_stats_warning: '⚠️ 警告：您即将清理所有统计数据，此操作不可恢复！',
        cleanup_key_prefix: '密钥: ',
        cleanup_model_prefix: '模型: ',
        cleanup_start_prefix: '起始日期: ',
        cleanup_end_prefix: '结束日期: ',
        cleanup_status_prefix: '状态过滤: ',
        deleted_keys_count: '成功删除 {count} 个禁用密钥',
        orphan_logs_count: '成功清理 {count} 条孤立日志',
        key_action_enabled: '密钥已启用',
        key_action_disabled: '密钥已禁用',
        login_failed: '登录失败',
        // Model picker
        models_picker_title: '从源API获取到以下模型，勾选后添加：',
        select_all: '全选',
        deselect_all: '取消全选',
        add_selected: '添加勾选的模型',
        close: '关闭',
        supported_models_hint: '添加此源API支持的模型名称（可选），填写 Base URL 和 API Key 后可从源API自动获取',
        fetch_models: '从源API获取模型',
        manual_add: '手动添加',
        cleanup_stats: '清理统计数据',
        global_label: '全局',
        logs_cleared: '日志已清空',
        logs_deleted: '条日志',
        stats_deleted: '条统计',
        backup_file_prefix: '备份成功！文件：',
        backup_failed_prefix: '备份失败：',
        export_failed_prefix: '导出失败：',
        import_failed_prefix: '导入失败：',
        cleanup_failed_prefix: '清理失败: ',
        create_failed_prefix: '创建失败: ',
        success_cleaned_logs: '成功清理',
        logs_record_suffix: ' 条日志记录',
        stats_record_suffix: ' 条统计记录',
        // Log filters
        log_key_id: '密钥 ID',
        start_date: '开始日期',
        end_date: '结束日期',
        supported_models: '支持的模型',
        query: '查询',
        filter: '筛选',
        reset: '重置',
        all_status: '全部',
        status_200: '200 - 成功',
        status_400: '400 - 请求错误',
        status_401: '401 - 认证失败',
        status_429: '429 - 限流',
        status_500: '500 - 服务器错误',
        ph_key_id: '筛选密钥',
        ph_model: '筛选模型',
        admin_password: '管理员密码',
        // Model picker
        please_fill_base_url_api_key: '请先填写 Base URL 和 API Key',
        fetch_models_failed: '获取模型失败',
        no_models_found: '未找到模型',
        please_select_models: '请选择要添加的模型',
        added_models_count: '成功添加 {count} 个模型',
        edit_binding: '编辑',
        please_save_source_first: '请先保存源 API 配置后再获取模型',
        ph_source_name: '例如：OpenRouter API',
        ph_base_url: 'https://openrouter.ai/api/v1',
        ph_api_key: 'sk-or-xxx',
        ph_model_input: '输入模型名称，按回车添加',
        source_model_hint: '源模型列表来自源 API 配置，可在编辑源 API 时修改',
        model_id_optional: '模型 ID（可选）',
    },
    en: {
        // Top bar
        service_running: 'Service Running',
        logout: 'Logout',
        login: 'Login',
        logging_in: 'Logging in...',
        synced: 'Synced',
        not_synced: 'Not Synced',
        input_password: 'Enter password',
        // Common
        name: 'Name',
        api_key: 'API Key',
        status: 'Status',
        operations: 'Actions',
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        no_data: 'No data available',
        // Sections
        request_logs: 'Request Logs',
        export_logs: 'Export Logs',
        clear_logs: 'Clear Logs',
        // Source API
        test_source: 'Test',
        testing: 'Testing...',
        test_success: 'Test Passed',
        test_failed: 'Test Failed',
        confirm_test: 'Are you sure you want to test this source API connection?',
        add_source_api: 'Add Source API',
        edit_source_api: 'Edit Source API',
        // Keys
        key_management: 'Key Management',
        create_key: 'Create Key',
        key_name: 'Key Name',
        rate_limit: 'Rate Limit',
        req_per_min: 'req/min',
        created_at: 'Created',
        expires_at: 'Expires',
        usage_stats: 'View Stats',
        edit: 'Edit',
        enable: 'Enable',
        disable: 'Disable',
        delete: 'Delete',
        // Models
        model_config: 'Model Config',
        source_api_config: 'Source API Config',
        virtual_model_id: 'Virtual Model ID',
        binding_relationship: 'Binding',
        create_model_id: 'Create Model ID',
        create_binding: 'Create Binding',
        // Dashboard
        dashboard: 'Dashboard',
        refresh: 'Refresh',
        today_requests: "Today's Requests",
        today_tokens: "Today's Tokens",
        active_keys: 'Active Keys',
        error_rate: 'Error Rate',
        realtime_monitor: 'Realtime Monitor',
        top_users_today: 'Active Users Today',
        top_models: 'Top Models',
        active: 'Active',
        normal: 'Normal',
        // Logs
        filter: 'Filter',
        reset: 'Reset',
        key_id: 'Key ID',
        model: 'Model',
        status_code: 'Status Code',
        start_date: 'Start Date',
        end_date: 'End Date',
        client_ip: 'Client IP',
        input_output_tokens: 'Input/Output Tokens',
        response_time: 'Response Time',
        error_message: 'Error Message',
        // Stats
        stats_report: 'Statistics',
        query: 'Query',
        total_requests: 'Total Requests',
        total_input_tokens: 'Total Input Tokens',
        total_output_tokens: 'Total Output Tokens',
        total_errors: 'Total Errors',
        total_tokens: 'Total Tokens',
        avg_req_per_user: 'Avg Req/User',
        by_date: 'By Date',
        by_user: 'By User',
        date: 'Date',
        request_count: 'Requests',
        // Settings
        settings: 'Settings',
        rate_limit_config: 'Rate Limiting',
        global_rpm: 'Global Rate Limit (req/min)',
        default_key_rpm: 'Default Key Rate Limit (req/min)',
        save_rate_limit: 'Save Rate Limit',
        security_settings: 'Security',
        new_admin_password: 'New Admin Password',
        change_password: 'Change Password',
        service_info: 'Service Info',
        service_status: 'Service Status',
        running: 'Running',
        listen_address: 'Listen Address',
        api_version: 'API Version',
        data_cleanup: '⚠️ Data Cleanup',
        warning_text: 'These actions cannot be undone. Use with caution!',
        clear_request_logs: 'Clear Request Logs',
        clear_stats: 'Clear Statistics',
        clear_disabled_keys: 'Clear Disabled Keys',
        clear_orphan_logs: 'Clear Orphan Logs',
        db_backup: 'Database Backup & Restore',
        backup_reminder: 'Back up your data regularly',
        create_backup: 'Create Backup',
        export_db: 'Export Database',
        import_db: 'Import Database',
        privacy_filter_settings: 'Privacy Filter',
        enable_privacy_filter: 'Enable Privacy Filter',
        filter_hint: 'Filter sensitive info from source API (provider details, metadata, etc.)',
        filter_metadata: 'Filter Metadata (ID, created time, etc.)',
        filter_usage_details: 'Filter Usage Details (keep only basic token stats)',
        filter_provider_info: 'Filter Provider Info',
        filter_error_details: 'Filter Error Details (use custom error messages)',
        // Lang names
        lang_name_zh: '中文',
        lang_name_en: 'English',
        // Modal
        confirm_password: 'Confirm Password Change',
        confirm_password_hint: 'Changing the password is a sensitive action. Please confirm your identity.',
        current_password: 'Current Password',
        new_password: 'New Password',
        confirm_change: 'Confirm',
        cancel: 'Cancel',
        save: 'Save',
        // Forms
        placeholder_name: 'e.g.: Production Key',
        placeholder_description: 'Optional description',
        remarks: 'Description',
        expiry: 'Expiry',
        permanent: 'Permanent',
        activated: 'Activated',
        disabled: 'Disabled',
        no_keys_yet: 'No keys yet. Create a new one.',
        no_sources_yet: 'No source API configured.',
        no_virtual_models_yet: 'No virtual models yet.',
        no_bindings_yet: 'No bindings yet.',
        no_logs_yet: 'No log records yet.',
        // Confirmations
        confirm_delete_key: 'Are you sure you want to delete this key? This cannot be undone.',
        confirm_delete_source: 'Deleting the source API will also delete related bindings. Continue?',
        confirm_delete_vm: 'Deleting the virtual model will also delete related bindings. Continue?',
        confirm_delete_binding: 'Are you sure you want to delete this binding?',
        confirm_clear_logs: 'Are you sure you want to clear all logs and statistics? This cannot be undone.',
        confirm_cleanup_all: '⚠️ WARNING: You are about to clear all data. This cannot be undone!\n\nContinue?',
        confirm_cleanup_cond: 'Confirm cleanup with the following conditions:\n\nThis cannot be undone. Continue?',
        confirm_import: '⚠️ WARNING: Importing will overwrite existing data. This cannot be undone!\n\nContinue?',
        confirm_delete_disabled_keys: 'Are you sure you want to delete all disabled keys?',
        confirm_delete_orphan_logs: 'Are you sure you want to clear orphan log records?\n\nOrphan logs are records whose keys have been deleted.',
        // Toasts
        logs_exported: 'Logs exported',
        export_failed: 'Export failed',
        filter_applied: 'Filter applied',
        key_created: 'Key created successfully!',
        key_deleted: 'Key deleted',
        key_updated: 'Config updated',
        key_enabled: 'Key enabled',
        key_disabled: 'Key disabled',
        source_created: 'Source API created',
        source_updated: 'Source API updated',
        source_deleted: 'Source API deleted',
        vm_created: 'Virtual model created',
        vm_deleted: 'Virtual model deleted',
        binding_created: 'Binding created',
        binding_updated: 'Binding updated',
        binding_deleted: 'Binding deleted',
        rate_limit_saved: 'Rate limit saved',
        password_changed: 'Password changed',
        privacy_saved: 'Privacy filter settings saved',
        backup_success: 'Backup successful!',
        export_success: 'Database exported successfully',
        import_success: 'Database imported successfully, refreshing...',
        cleanup_success: 'Successfully cleaned {count} records',
        no_disabled_keys: 'No disabled keys to delete',
        no_orphan_logs: 'No orphan logs to clean',
        // Placeholders
        ph_key_id: 'Filter by Key ID',
        ph_model: 'Filter by Model',
        ph_key_id_stats: 'Leave empty to view all',
        ph_key_name: 'e.g.: Production Key',
        ph_description: 'Optional description',
        ph_new_password: 'Enter new password',
        input_password: 'Enter password',
        // Table headers
        key_id_header: 'Key ID',
        created_at: 'Created',
        expires_at: 'Expires',
        rate_limit_header: 'Rate Limit',
        usage_stats_header: 'Stats',
        operations_header: 'Actions',
        // Stats
        today_input_tokens: 'Input Tokens Today',
        today_output_tokens: 'Output Tokens Today',
        input_output_ratio: 'Input/Output Ratio',
        avg_response_time: 'Avg Response Time',
        active_ips: 'Active IPs',
        requests_last_min: 'Requests (Last 1 Min)',
        active_requests: 'Active Requests',
        requests_last_5min: 'Request Rate (Last 5 Min)',
        req_per_min: 'req/min',
        last_5min: 'Last 5 Min',
        top_users_today: 'Active Users Today',
        top_models: 'Top Models',
        user: 'User',
        request_count: 'Requests',
        token_usage: 'Token Usage',
        avg_response: 'Avg Response',
        by_date: 'By Date',
        by_user: 'By User',
        // Forms
        key_name_req: 'Key Name *',
        rate_limit_rpm: 'Rate Limit (req/min)',
        expiry: 'Expiry',
        remarks: 'Description',
        rate_limit_config: 'Rate Limiting',
        global_rpm: 'Global Rate Limit (req/min)',
        default_key_rpm: 'Default Key Rate Limit (req/min)',
        security_settings: 'Security',
        new_admin_password_label: 'New Admin Password',
        service_info: 'Service Info',
        service_status: 'Service Status',
        running: 'Running',
        listen_address: 'Listen Address',
        api_version_label: 'API Version',
        data_cleanup: '⚠️ Data Cleanup',
        warning_text: 'These actions cannot be undone. Use with caution!',
        // Realtime
        realtime_monitor: 'Realtime Monitor',
        // New keys
        key_detail: 'Key Details',
        copy: 'Copy',
        edit_key_config: 'Edit Key Config',
        model_config_three_steps: 'Model Config (3-Step)',
        source_api_step1: '① Source API',
        virtual_model_step2: '② Virtual Model ID',
        binding_step3: '③ Binding',
        time: 'Time',
        key: 'Key',
        prev_page: 'Previous',
        next_page: 'Next',
        page_num: 'Page {n}',
        description: 'Description',
        model_id: 'Model ID',
        virtual_model: 'Virtual Model',
        source_api: 'Source API',
        source_model: 'Source Model',
        priority: 'Priority',
        name_required: 'Name *',
        base_url_required: 'Base URL *',
        api_key_required: 'API Key *',
        create_virtual_model: 'Create Virtual Model',
        create_binding: 'Create Binding',
        update_binding: 'Update Binding',
        cleanup_key_id: 'Key ID (Optional)',
        cleanup_model: 'Model (Optional)',
        cleanup_start_date: 'Start Date (Optional)',
        cleanup_end_date: 'End Date (Optional)',
        cleanup_status_filter: 'Status Filter (Optional)',
        no_filter: 'No Filter',
        success_requests: 'Success Requests',
        error_requests: 'Error Requests',
        cleanup_warning_logs: '⚠️ Warning: This will permanently delete matching log records. Cannot be undone!',
        cleanup_warning_stats: '⚠️ Warning: This will permanently delete matching statistics. Cannot be undone!',
        confirm_cleanup: 'Confirm Cleanup',
        cleanup_stats_title: 'Cleanup Statistics',
        cleanup_logs_title: 'Cleanup Request Logs',
        api_relay_service: 'API Relay Service',
        copyright: 'Copyright © 2026 PLXT',
        base_url: 'Base URL',
        input_token: 'Input Tokens',
        output_token: 'Output Tokens',
        error_count: 'Errors',
        key_not_found: 'Key not found',
        copy_failed: 'Copy failed',
        browser_no_copy: 'Browser does not support clipboard',
        key_copied: 'Key copied to clipboard',
        select_virtual_model: 'Select Virtual Model',
        select_source_api: 'Select Source API',
        select_source_model: 'Select Source Model',
        or_manual_input: 'Or enter manually',
        manual_input_label: '-- Manual Input --',
        manual_input_placeholder: 'Enter source model name',
        select_or_input_model: 'Please select or enter source model name',
        select_or_input_model_error: 'Please select or enter source model name',
        binding_created_success: 'Binding created',
        binding_updated_success: 'Binding updated',
        binding_deleted_success: 'Binding deleted',
        binding_not_active: 'Active',
        binding_inactive: 'Disabled',
        no_bindings_yet: 'No bindings yet',
        create_failed: 'Creation failed',
        update_failed: 'Update failed',
        unauthorized: 'Unauthorized, please login again',
        session_invalid: 'Session invalid, please login again',
        request_failed: 'Request failed',
        network_error: 'Network error',
        password_min_length: 'Password must be at least 6 characters',
        please_enter_current_password: 'Please enter current password',
        current_password_wrong: 'Current password is incorrect',
        password_change_failed: 'Password change failed',
        unknown_error: 'Unknown error',
        cleanup_failed: 'Cleanup failed',
        select_zip: 'Please select a .zip backup file',
        no_key_data: 'No key data',
        browser_no_support: 'Browser not supported',
        key_copied_short: 'Key copied',
        models_suffix: 'models',
        source_model_label: 'Source Model:',
        api_key_label: 'API Key:',
        base_url_label: 'Base URL:',
        model_enabled: 'Enabled',
        model_disabled: 'Disabled',
        add_first_model: 'Add First Model',
        model_config_saved: 'Model config saved',
        model_deleted: 'Model deleted',
        key_disabled_status: 'Disabled',
        key_active_status: 'Active',
        permanent_status: 'Permanent',
        view_stats_btn: 'View Stats',
        key_name_label: 'Key Name',
        key_id_label: 'Key ID',
        created_at_label: 'Created',
        expires_at_label: 'Expires',
        rate_limit_label: 'Rate Limit',
        req_per_min_label: 'req/min',
        status_label: 'Status',
        remarks_label: 'Remarks',
        close_btn: 'Close',
        total_requests_label: 'Total Requests',
        total_token_label: 'Total Tokens',
        input_token_label: 'Input Tokens',
        output_token_label: 'Output Tokens',
        key_stats_title: 'Key Statistics',
        cleanup_summary_prefix: 'Confirm cleanup with the following conditions:',
        cleanup_all_warning: '⚠️ Warning: You are about to clear all request logs. This cannot be undone!',
        cleanup_all_stats_warning: '⚠️ Warning: You are about to clear all statistics. This cannot be undone!',
        cleanup_key_prefix: 'Key: ',
        cleanup_model_prefix: 'Model: ',
        cleanup_start_prefix: 'Start Date: ',
        cleanup_end_prefix: 'End Date: ',
        cleanup_status_prefix: 'Status Filter: ',
        deleted_keys_count: 'Successfully deleted {count} disabled keys',
        orphan_logs_count: 'Successfully cleaned {count} orphan logs',
        key_action_enabled: 'Key enabled',
        key_action_disabled: 'Key disabled',
        login_failed: 'Login failed',
        // Model picker
        models_picker_title: 'Models fetched from source API, select to add:',
        select_all: 'Select All',
        deselect_all: 'Deselect All',
        add_selected: 'Add Selected Models',
        close: 'Close',
        supported_models_hint: 'Add supported model names (optional). Fill in Base URL and API Key to auto-fetch from source API',
        fetch_models: 'Fetch Models from Source API',
        manual_add: 'Manual Add',
        cleanup_stats: 'Cleanup Statistics',
        global_label: 'Global',
        logs_cleared: 'Logs cleared',
        logs_deleted: ' logs',
        stats_deleted: ' statistics',
        backup_file_prefix: 'Backup successful! File: ',
        backup_failed_prefix: 'Backup failed: ',
        export_failed_prefix: 'Export failed: ',
        import_failed_prefix: 'Import failed: ',
        cleanup_failed_prefix: 'Cleanup failed: ',
        create_failed_prefix: 'Creation failed: ',
        success_cleaned_logs: 'Successfully cleaned',
        logs_record_suffix: ' log records',
        stats_record_suffix: ' statistics records',
        // Log filters
        log_key_id: 'Key ID',
        start_date: 'Start Date',
        end_date: 'End Date',
        supported_models: 'Supported Models',
        query: 'Query',
        filter: 'Filter',
        reset: 'Reset',
        all_status: 'All',
        status_200: '200 - Success',
        status_400: '400 - Bad Request',
        status_401: '401 - Unauthorized',
        status_429: '429 - Rate Limited',
        status_500: '500 - Server Error',
        ph_key_id: 'Filter by Key ID',
        ph_model: 'Filter by Model',
        admin_password: 'Admin Password',
        // Model picker
        please_fill_base_url_api_key: 'Please fill in Base URL and API Key first',
        fetch_models_failed: 'Failed to fetch models',
        no_models_found: 'No models found',
        please_select_models: 'Please select models to add',
        added_models_count: 'Successfully added {count} models',
        edit_binding: 'Edit',
        please_save_source_first: 'Please save the source API configuration first before fetching models',
        ph_source_name: 'e.g.: OpenRouter API',
        ph_base_url: 'https://openrouter.ai/api/v1',
        ph_api_key: 'sk-or-xxx',
        ph_model_input: 'Enter model name, press Enter to add',
        source_model_hint: 'Source model list comes from source API configuration, can be modified when editing source API',
        model_id_optional: 'Model ID (Optional)',
    }
};

// ========================================
// API 请求辅助函数
// ========================================
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': sessionToken || ''
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`/admin/api/${endpoint}`, options);

        if (response.status === 401) {
            showToast(t('unauthorized'), 'error');
            logout();
            return null;
        }

        if (response.status === 403) {
            showToast(t('session_invalid'), 'error');
            logout();
            return null;
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: t('request_failed') }));
            showToast(error.detail || `HTTP ${response.status}`, 'error');
            return null;
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API Error:', error);
        showToast(t('network_error'), 'error');
        return null;
    }
}

// ========================================
// 提示消息
// ========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// 国际化 (i18n)
// ========================================
function t(key) {
    return i18n[currentLang]?.[key] || i18n.zh[key] || key;
}

function toggleLangDropdown() {
    const dropdown = document.getElementById('lang-dropdown');
    if (!dropdown) return;
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function selectLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('preferredLanguage', lang);
    document.getElementById('lang-dropdown').style.display = 'none';

    // 更新语言选择器的 active 状态
    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.classList.remove('active');
    });
    const activeOption = document.querySelector(`.lang-option[data-lang="${lang}"]`);
    if (activeOption) {
        activeOption.classList.add('active');
    }

    updateLangLabel();
    applyLanguage();
}

function updateLangLabel() {
    const label = document.getElementById('lang-current-label');
    if (label) {
        label.textContent = t('lang_name_' + currentLang);
    }
}

// 关闭语言下拉框 (点击外部区域)
document.addEventListener('click', function(e) {
    const langSelector = document.querySelector('.lang-selector');
    if (langSelector && !langSelector.contains(e.target)) {
        const dropdown = document.getElementById('lang-dropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

function applyLanguage() {
    // 更新所有带有 data-i18n 属性的元素
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = t(key);
        if (text) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = text;
            } else {
                el.textContent = text;
            }
        }
    });
    // 更新 placeholder (data-i18n-placeholder)
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const text = t(key);
        if (text) el.placeholder = text;
    });
    // 更新语言标签
    updateLangLabel();
}

// ========================================
// 服务器时间显示
// ========================================
let serverTimeOffset = 0;
let serverTimeSynced = false;

async function syncServerTime() {
    try {
        const startTime = Date.now();
        const resp = await fetch('/admin/api/server-time', {
            headers: { 'X-Session-Token': sessionToken }
        });
        const endTime = Date.now();

        if (resp.ok) {
            const data = await resp.json();
            serverTimeOffset = data.server_timestamp * 1000 - startTime;
            serverTimeSynced = true;
            updateServerTimeDisplay();
        } else {
            serverTimeSynced = false;
            updateServerTimeDisplay();
        }
    } catch (e) {
        serverTimeSynced = false;
        updateServerTimeDisplay();
    }
}

function getServerTime() {
    return new Date(Date.now() + serverTimeOffset);
}

function updateServerTimeDisplay() {
    // Dashboard header time display
    const timeDisplay = document.getElementById('server-time-display');
    const syncText = document.getElementById('server-time-sync-text');
    const syncDot = document.getElementById('server-time-sync-dot');

    if (timeDisplay) {
        const now = getServerTime();
        const lang = currentLang === 'zh' ? 'zh-CN' : 'en-US';
        timeDisplay.textContent = now.toLocaleString(lang, {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    if (syncText) {
        syncText.textContent = serverTimeSynced ? t('synced') : t('not_synced');
    }
    if (syncDot) {
        syncDot.className = serverTimeSynced ? 'sync-dot synced' : 'sync-dot';
    }
}

// 服务器时间同步定时器 (登录后启动)
let timeUpdateInterval = null;
let timeSyncInterval = null;

function startServerTimeSync() {
    // 只启动一次
    if (timeUpdateInterval || timeSyncInterval) return;
    timeUpdateInterval = setInterval(updateServerTimeDisplay, 1000);
    timeSyncInterval = setInterval(syncServerTime, 30000);
    syncServerTime(); // 立即同步一次
}

function stopServerTimeSync() {
    if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
        timeUpdateInterval = null;
    }
    if (timeSyncInterval) {
        clearInterval(timeSyncInterval);
        timeSyncInterval = null;
    }
}
async function login(password) {
    try {
        const response = await fetch('/admin/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || t('login_failed'));
        }

        const data = await response.json();
        sessionToken = data.session_token;
        localStorage.setItem('sessionToken', sessionToken);
        startServerTimeSync(); // 启动服务器时间同步
        showMainPanel();
        return true;
    } catch (error) {
        document.getElementById('login-error').textContent = error.message;
        return false;
    }
}

function logout() {
    // 通知服务器端清除会话
    if (sessionToken) {
        fetch('/admin/api/logout', {
            method: 'POST',
            headers: { 'X-Session-Token': sessionToken }
        }).catch(() => {}); // 忽略错误
    }
    stopServerTimeSync(); // 停止服务器时间同步
    sessionToken = '';
    localStorage.removeItem('sessionToken');
    document.getElementById('login-page').classList.add('active');
    document.getElementById('main-panel').classList.remove('active');
}

async function showMainPanel() {
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('main-panel').classList.add('active');
    await loadDashboard();
}

// ========================================
// 页面导航
// ========================================
function navigateTo(page) {
    currentPage = page;

    // 更新导航链接状态
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

    // 显示对应 section
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`${page}-section`)?.classList.add('active');

    // 加载页面数据
    switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'keys': loadKeys(); break;
        case 'models': switchModelTab('sources'); loadSources(); loadVirtualModels(); loadBindings(); break;
        case 'logs': loadLogs(); break;
        case 'stats': loadStatistics(); break;
        case 'settings': loadSettings(); break;
    }
}

// ========================================
// 仪表板
// ========================================
async function refreshDashboard() {
    loadDashboard();
}

async function loadUsageSummary() {
    const summary = await apiRequest('usage-summary');
    if (!summary) return;

    // 今日统计
    if (summary.today) {
        document.getElementById('requests-today').textContent = formatNumber(summary.today.requests);
        document.getElementById('input-tokens-today').textContent = formatNumber(summary.today.input_tokens);
        document.getElementById('output-tokens-today').textContent = formatNumber(summary.today.output_tokens);
        document.getElementById('error-rate').textContent = `${summary.today.errors}`;
        if (summary.today.active_users) {
            document.getElementById('active-keys').textContent = summary.today.active_users;
        }
    }
}

async function loadDashboard() {
    const data = await apiRequest('dashboard');
    if (!data) return;

    const dashboard = data.dashboard;

    // 更新统计卡片
    document.getElementById('requests-today').textContent = formatNumber(dashboard.requests_today || 0);
    document.getElementById('tokens-today').textContent = formatNumber(dashboard.tokens_today || 0);
    document.getElementById('error-rate').textContent = `${dashboard.error_rate_24h || 0}%`;

    // 更新详细的 Token 统计
    if (dashboard.input_tokens_today !== undefined) {
        document.getElementById('input-tokens-today').textContent = formatNumber(dashboard.input_tokens_today);
    }
    if (dashboard.output_tokens_today !== undefined) {
        document.getElementById('output-tokens-today').textContent = formatNumber(dashboard.output_tokens_today);
    }
    if (dashboard.input_output_ratio !== undefined) {
        const ratio = parseFloat(dashboard.input_output_ratio);
        // 左边固定为输入，右边固定为输出，数值≥1
        // ratio = output / input，所以 input / output = 1 / ratio
        // 如果 ratio >= 1 (输出>=输入)，显示为 1:ratio，即 输入:输出
        // 如果 ratio < 1 (输出<输入)，显示为 (1/ratio):1，即 输入:输出
        let ratioText;
        if (ratio >= 1) {
            ratioText = `1:${ratio.toFixed(3)}`;
        } else {
            ratioText = `${(1 / ratio).toFixed(3)}:1`;
        }
        document.getElementById('input-output-ratio').textContent = ratioText;
    }

    // 更新平均响应时间和活跃IP数
    if (dashboard.avg_response_time_today !== undefined) {
        document.getElementById('avg-response-time-today').textContent =
            dashboard.avg_response_time_today ? Math.round(dashboard.avg_response_time_today) + 'ms' : '--ms';
    }
    if (dashboard.active_ips_24h !== undefined) {
        document.getElementById('active-ips-today').textContent = formatNumber(dashboard.active_ips_24h);
    }

    // 获取活跃密钥数
    const keysData = await apiRequest('keys');
    if (keysData) {
        const activeKeys = keysData.keys?.filter(k => k.is_active).length || 0;
        document.getElementById('active-keys').textContent = activeKeys;
    }

    // 加载实时监控数据
    refreshRealtimeStats();

    // 活跃用户排行（使用今日活跃用户）
    const topUsersTable = document.getElementById('top-users-table');
    if (data.top_users && data.top_users.length > 0) {
        topUsersTable.innerHTML = data.top_users.map(user => `
            <tr>
                <td>
                    <div class="text-truncate" style="max-width: 200px;">
                        ${escapeHtml(user.name) || user.key_id?.substring(0, 8) + '...'}
                    </div>
                </td>
                <td>${formatNumber(user.request_count)}</td>
                <td>${formatNumber(user.total_tokens)}</td>
                <td><span class="status-badge status-active"><span class="status-dot-small"></span>${t('active')}</span></td>
            </tr>
        `).join('');
    } else {
        topUsersTable.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">' + t('no_data') + '</td></tr>';
    }

    // 热门模型排行
    const topModelsTable = document.getElementById('top-models-table');
    if (data.top_models && data.top_models.length > 0) {
        topModelsTable.innerHTML = data.top_models.map(model => `
            <tr>
                <td><span class="font-mono">${escapeHtml(model.model)}</span></td>
                <td>${formatNumber(model.request_count)}</td>
                <td>${Math.round(model.avg_response_time || 0)}ms</td>
                <td><span class="status-badge status-active"><span class="status-dot-small"></span>${t('normal')}</span></td>
            </tr>
        `).join('');
    } else {
        topModelsTable.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">' + t('no_data') + '</td></tr>';
    }
}

// ========================================
// 密钥管理
// ========================================
function showCreateKeyForm() {
    document.getElementById('create-key-form').style.display = 'block';
}

function hideCreateKeyForm() {
    document.getElementById('create-key-form').style.display = 'none';
    document.getElementById('new-key-form').reset();
}

async function createKey(event) {
    event.preventDefault();

    const name = document.getElementById('key-name').value;
    const rateLimit = parseInt(document.getElementById('key-rate-limit').value);
    const expiry = document.getElementById('key-expiry').value;
    const description = document.getElementById('key-description').value;

    const data = {
        name,
        rate_limit: rateLimit,
        expires_at: expiry ? new Date(expiry).toISOString() : null,
        metadata: description ? { description } : null
    };

    const result = await apiRequest('keys', 'POST', data);

    if (result) {
        showToast(t('key_created'), 'success');

        // 显示密钥模态框
        showKeyModal(result.name, result.api_key);

        hideCreateKeyForm();
        loadKeys();
    }
}

// API密钥相关函数
let currentShowKey = '';

function showKeyModal(name, key) {
    document.getElementById('show-key-name').value = name;
    document.getElementById('show-key-value').value = key;
    currentShowKey = key;
    document.getElementById('show-key-modal').style.display = 'block';
}

function closeShowKeyModal() {
    document.getElementById('show-key-modal').style.display = 'none';
    currentShowKey = '';
}

function copyApiKey() {
    const keyInput = document.getElementById('show-key-value');
    keyInput.select();

    if (navigator.clipboard) {
        navigator.clipboard.writeText(currentShowKey).then(() => {
            showToast(t('key_copied_short'), 'success');
        }).catch(() => {
            showToast(t('key_copied_short'), 'success');
        });
    } else {
        showToast(t('key_copied_short'), 'success');
    }
}

async function loadKeys() {
    const data = await apiRequest('keys');
    if (!data) return;

    allKeys = data.keys || [];
    const keysTable = document.getElementById('keys-table');

    if (allKeys.length === 0) {
        keysTable.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">' + t('no_keys_yet') + '</td></tr>';
        return;
    }

    keysTable.innerHTML = allKeys.map(key => `
        <tr>
            <td>
                <div style="font-weight: 500;">${escapeHtml(key.name)}</div>
                ${key.metadata?.description ? `<div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(key.metadata.description)}</div>` : ''}
            </td>
            <td class="font-mono" style="font-size: 12px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(key.api_key || '')}">${escapeHtml((key.api_key || '').substring(0, 12))}...</span>
                    <button class="btn btn-sm btn-secondary" onclick="copyPlainTextKey('${key.key_id}')" style="padding: 2px 6px; font-size: 11px;">${t('copy')}</button>
                </div>
            </td>
            <td>${formatDate(key.created_at)}</td>
            <td>${key.expires_at ? formatDate(key.expires_at) : `<span style="color: var(--text-muted);">${t('permanent_status')}</span>`}</td>
            <td><span class="font-mono">${key.rate_limit}</span> req/min</td>
            <td>
                <button type="button" class="btn btn-sm" style="padding: 2px 8px; font-size: 12px; color: var(--primary); background: none; border: 1px solid var(--primary);" onclick="showKeyStats('${key.key_id}')">${t('view_stats_btn')}</button>
            </td>
            <td>
                <span class="status-badge ${key.is_active ? 'status-active' : 'status-inactive'}">
                    <span class="status-dot-small"></span>
                    ${key.is_active ? t('key_active_status') : t('key_disabled_status')}
                </span>
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-secondary" onclick="editKey('${key.key_id}')">${t('edit')}</button>
                    ${key.is_active ? `
                        <button class="btn btn-sm btn-secondary" onclick="toggleKeyStatus('${key.key_id}', false)">${t('disable')}</button>
                    ` : `
                        <button class="btn btn-sm btn-secondary" onclick="toggleKeyStatus('${key.key_id}', true)">${t('enable')}</button>
                    `}
                    <button class="btn btn-sm btn-danger" onclick="deleteKey('${key.key_id}')">${t('delete')}</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// 复制明文密钥
async function copyPlainTextKey(keyId) {
    const key = allKeys.find(k => k.key_id === keyId);
    if (!key || !key.api_key) {
        showToast(t('key_not_found'), 'error');
        return;
    }

    if (navigator.clipboard) {
        navigator.clipboard.writeText(key.api_key).then(() => {
            showToast(t('key_copied'), 'success');
        }).catch(() => {
            showToast(t('copy_failed'), 'error');
        });
    } else {
        showToast(t('browser_no_copy'), 'error');
    }
}

async function toggleKeyStatus(keyId, isActive) {
    const result = await apiRequest(`keys/${keyId}`, 'PATCH', { is_active: isActive });
    if (result) {
        showToast(isActive ? t('key_action_enabled') : t('key_action_disabled'), 'success');
        loadKeys();
    }
}

async function showKeyDetail(keyId) {
    const key = allKeys.find(k => k.key_id === keyId);
    if (!key) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h3>${t('key_detail')}</h3>
                <button class="btn-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div style="padding: 24px;">
                <div class="info-list">
                    <div class="info-item">
                        <span class="info-label">${t('key_name_label')}</span>
                        <span class="info-value">${escapeHtml(key.name)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${t('key_id_label')}</span>
                        <span class="info-value font-mono">${key.key_id}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${t('created_at_label')}</span>
                        <span class="info-value">${formatDateTime(key.created_at)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${t('expires_at_label')}</span>
                        <span class="info-value">${key.expires_at ? formatDateTime(key.expires_at) : t('permanent_status')}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${t('rate_limit_label')}</span>
                        <span class="info-value">${key.rate_limit} ${t('req_per_min_label')}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${t('status_label')}</span>
                        <span class="info-value">
                            <span class="status-badge ${key.is_active ? 'status-active' : 'status-inactive'}">
                                ${key.is_active ? t('key_active_status') : t('key_disabled_status')}
                            </span>
                        </span>
                    </div>
                    ${key.metadata?.description ? `
                    <div class="info-item">
                        <span class="info-label">${t('remarks_label')}</span>
                        <span class="info-value">${escapeHtml(key.metadata.description)}</span>
                    </div>
                    ` : ''}
                </div>
                <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">${t('close_btn')}</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function showKeyStats(keyId) {
    const stats = await apiRequest(`user-stats/${keyId}`);
    if (stats) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${t('key_stats_title')}</h3>
                    <button class="btn-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div style="padding: 24px;">
                    <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); gap: 12px;">
                        <div class="stat-card" style="padding: 16px;">
                            <div class="stat-content">
                                <span class="stat-label">${t('total_requests_label')}</span>
                                <span class="stat-value" style="font-size: 20px;">${formatNumber(stats.total_requests || 0)}</span>
                            </div>
                        </div>
                        <div class="stat-card" style="padding: 16px;">
                            <div class="stat-content">
                                <span class="stat-label">${t('total_token_label')}</span>
                                <span class="stat-value" style="font-size: 20px;">${formatNumber((stats.total_input_tokens || 0) + (stats.total_output_tokens || 0))}</span>
                            </div>
                        </div>
                        <div class="stat-card" style="padding: 16px;">
                            <div class="stat-content">
                                <span class="stat-label">${t('input_token_label')}</span>
                                <span class="stat-value" style="font-size: 16px;">${formatNumber(stats.total_input_tokens || 0)}</span>
                            </div>
                        </div>
                        <div class="stat-card" style="padding: 16px;">
                            <div class="stat-content">
                                <span class="stat-label">${t('output_token_label')}</span>
                                <span class="stat-value" style="font-size: 16px;">${formatNumber(stats.total_output_tokens || 0)}</span>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 20px; text-align: center;">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">${t('close_btn')}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

async function deleteKey(keyId) {
    if (!confirm(t('confirm_delete_key'))) return;

    const result = await apiRequest(`keys/${keyId}`, 'DELETE');
    if (result) {
        showToast(t('key_deleted'), 'success');
        loadKeys();
    }
}

// 编辑密钥配置
async function editKey(keyId) {
    // 获取密钥详情
    const key = allKeys.find(k => k.key_id === keyId);
    if (!key) {
        showToast(t('key_not_found'), 'error');
        return;
    }

    // 填充表单
    document.getElementById('edit-key-id').value = keyId;
    document.getElementById('edit-key-name').value = key.name;
    document.getElementById('edit-key-rate-limit').value = key.rate_limit;
    document.getElementById('edit-key-encoded').value = key.api_key || '';

    // 显示模态框
    document.getElementById('edit-key-modal').style.display = 'block';
}

function copyPlainTextKeyFromEdit() {
    const keyInput = document.getElementById('edit-key-encoded');
    if (!keyInput.value) {
        showToast(t('no_key_data'), 'warning');
        return;
    }

    if (navigator.clipboard) {
        navigator.clipboard.writeText(keyInput.value).then(() => {
            showToast(t('key_copied_short'), 'success');
        }).catch(() => {
            showToast(t('copy_failed'), 'error');
        });
    } else {
        showToast(t('browser_no_support'), 'error');
    }
}

function closeEditKeyModal() {
    document.getElementById('edit-key-modal').style.display = 'none';
    document.getElementById('edit-key-form').reset();
}

async function updateKey(event) {
    event.preventDefault();

    const keyId = document.getElementById('edit-key-id').value;
    const data = {
        name: document.getElementById('edit-key-name').value,
        rate_limit: parseInt(document.getElementById('edit-key-rate-limit').value)
    };

    const result = await apiRequest(`keys/${keyId}`, 'PATCH', data);
    if (result) {
        showToast(t('key_updated'), 'success');
        closeEditKeyModal();
        loadKeys();
    }
}

// ========================================
// 模型配置
// ========================================
function showAddModelModal() {
    document.getElementById('add-model-modal').style.display = 'flex';
}

function closeAddModelModal() {
    document.getElementById('add-model-modal').style.display = 'none';
    document.getElementById('add-model-form').reset();
}

async function loadModels() {
    const config = await apiRequest('config');
    if (!config) return;

    allModels = config.models || {};
    const modelsList = document.getElementById('models-list');

    const modelEntries = Object.entries(allModels);
    if (modelEntries.length === 0) {
        modelsList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">
                <svg style="width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <p>${t('no_data')}</p>
                <button class="btn btn-primary" onclick="showAddModelModal()" style="margin-top: 16px;">${t('add_first_model')}</button>
            </div>
        `;
        return;
    }

    modelsList.innerHTML = modelEntries.map(([name, model]) => `
        <div class="model-card">
            <div class="model-card-header">
                <span class="model-name font-mono">${escapeHtml(name)}</span>
                <span class="model-status ${model.enabled ? 'active' : 'inactive'}">
                    ${model.enabled ? t('model_enabled') : t('model_disabled')}
                </span>
            </div>
            <div class="model-card-body">
                <div class="model-info">
                    <span class="model-info-label">${t('base_url_label')}</span>
                    <span class="model-info-value font-mono">${escapeHtml(model.source_base_url)}</span>
                </div>
                <div class="model-info">
                    <span class="model-info-label">${t('source_model_label')}</span>
                    <span class="model-info-value font-mono">${escapeHtml(model.source_model)}</span>
                </div>
                <div class="model-info">
                    <span class="model-info-label">${t('api_key_label')}</span>
                    <span class="model-info-value font-mono">${maskApiKey(model.source_api_key)}</span>
                </div>
            </div>
            <div class="model-card-actions">
                <button class="btn btn-sm btn-secondary" onclick="editModel('${escapeHtml(name)}')">${t('edit')}</button>
                <button class="btn btn-sm btn-${model.enabled ? 'warning' : 'success'}" onclick="toggleModel('${escapeHtml(name)}', ${!model.enabled})">
                    ${model.enabled ? t('disable') : t('enable')}
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteModel('${escapeHtml(name)}')">${t('delete')}</button>
            </div>
        </div>
    `).join('');
}

async function addModel(event) {
    event.preventDefault();

    const name = document.getElementById('model-name').value;
    const baseUrl = document.getElementById('model-base-url').value;
    const source = document.getElementById('model-source').value;
    const apiKey = document.getElementById('model-api-key').value;
    const enabled = document.getElementById('model-enabled').checked;

    // 只发送新模型配置，后端会自动合并
    const result = await apiRequest('config', 'POST', {
        models: {
            [name]: {
                source_base_url: baseUrl,
                source_model: source,
                source_api_key: apiKey,
                enabled
            }
        }
    });
    if (result) {
        showToast(t('model_config_saved'), 'success');
        closeAddModelModal();
        loadModels();
    }
}

async function toggleModel(name, enabled) {
    // 只发送需要更新的模型配置
    const result = await apiRequest('config', 'POST', {
        models: {
            [name]: {
                enabled
            }
        }
    });
    if (result) {
        showToast(enabled ? t('model_enabled') : t('model_disabled'), 'success');
        loadModels();
    }
}

async function deleteModel(name) {
    if (!confirm(t('confirm_delete_key'))) return;

    // 发送null表示删除该模型
    const result = await apiRequest('config', 'POST', { models: { [name]: null } });

    if (result) {
        showToast(t('model_deleted'), 'success');
        loadModels();
    }
}

function editModel(name) {
    const model = allModels[name];
    if (!model) return;

    document.getElementById('model-name').value = name;
    document.getElementById('model-base-url').value = model.source_base_url;
    document.getElementById('model-source').value = model.source_model;
    document.getElementById('model-api-key').value = model.source_api_key;
    document.getElementById('model-enabled').checked = model.enabled;

    showAddModelModal();
}

// ========================================
// 三步模型管理
// ========================================

// 切换标签页
function switchModelTab(tabName) {
    // 移除所有活动状态
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // 设置新的活动状态
    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.target.classList.add('active');

    // 加载对应数据
    if (tabName === 'sources') loadSources();
    if (tabName === 'virtual') loadVirtualModels();
    if (tabName === 'bindings') loadBindings();
}

// 显示添加源API模态框
function showAddSourceModal() {
    document.getElementById('add-source-modal').style.display = 'block';
    document.getElementById('add-source-form').reset();
}

// 源模型标签管理
let sourceModelsList = [];

function addSourceModelTag() {
    const input = document.getElementById('source-model-input');
    const value = input.value.trim();
    if (value && !sourceModelsList.includes(value)) {
        sourceModelsList.push(value);
        // 如果在编辑模式，同时更新editingSourceModels
        if (editingSourceId) {
            editingSourceModels = [...sourceModelsList];
        }
        renderSourceModelTags();
        input.value = '';
    }
}

function removeSourceModelTag(index) {
    sourceModelsList.splice(index, 1);
    // 如果在编辑模式，同时更新editingSourceModels
    if (editingSourceId) {
        editingSourceModels = [...sourceModelsList];
    }
    renderSourceModelTags();
}

function renderSourceModelTags() {
    const container = document.getElementById('source-models-list');
    if (container) {
        container.innerHTML = sourceModelsList.map((tag, i) => `
            <span class="tag">
                ${escapeHtml(tag)}
                <button type="button" class="tag-remove" onclick="removeSourceModelTag(${i})">×</button>
            </span>
        `).join('') + '<span style="color: var(--text-muted); font-size: 13px;">' + sourceModelsList.length + ' ' + t('models_suffix') + '</span>';
    }
}

function showAddSourceModal() {
    editingSourceId = null;
    document.getElementById('add-source-modal').style.display = 'block';
    document.getElementById('add-source-form').reset();
    sourceModelsList = [];
    renderSourceModelTags();

    // Initialize fetch models button listener
    initFetchModelsButton();
}

function closeAddSourceModal() {
    document.getElementById('add-source-modal').style.display = 'none';
    document.getElementById('add-source-form').reset();
    editingSourceId = null;
    editingSourceModels = [];
    sourceModelsList = [];
    renderSourceModelTags();
}

// 初始化获取模型按钮
function initFetchModelsButton() {
    const baseUrlInput = document.getElementById('source-base-url');
    const apiKeyInput = document.getElementById('source-api-key');
    const fetchBtn = document.getElementById('fetch-models-btn');

    if (baseUrlInput && apiKeyInput && fetchBtn) {
        const checkInputs = () => {
            const hasBaseUrl = baseUrlInput.value.trim().length > 0;
            const hasApiKey = apiKeyInput.value.trim().length > 0;
            fetchBtn.style.display = (hasBaseUrl && hasApiKey) ? 'inline-flex' : 'none';
        };

        // 移除旧的监听器
        const newBaseUrlInput = baseUrlInput.cloneNode(true);
        const newApiKeyInput = apiKeyInput.cloneNode(true);
        baseUrlInput.parentNode.replaceChild(newBaseUrlInput, baseUrlInput);
        apiKeyInput.parentNode.replaceChild(newApiKeyInput, apiKeyInput);

        newBaseUrlInput.addEventListener('input', checkInputs);
        newApiKeyInput.addEventListener('input', checkInputs);
        checkInputs();
    }
}

// 源模型选择器联动
async function updateSourceModelOptions() {
    const sourceId = document.getElementById('binding-source')?.value ||
                     document.getElementById('update-binding-source')?.value;

    const modelSelect = document.getElementById('binding-source-model') ||
                        document.getElementById('update-binding-source-model');

    if (!sourceId || !modelSelect) return;

    // 获取源API详情
    const sourcesResponse = await apiRequest('source-apis');
    const sources = sourcesResponse?.source_apis || [];
    const source = sources.find(s => s.source_id === sourceId);

    if (source && source.supported_models && source.supported_models.length > 0) {
        // 使用源API配置中的模型列表
        modelSelect.innerHTML = '<option value="">' + t('select_source_model') + '</option>' +
            source.supported_models.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    } else {
        // 如果没有配置，提供手动输入选项
        modelSelect.innerHTML = '<option value="">' + t('or_manual_input') + '</option>';
        // 添加一个隐藏的输入框用于手动输入
        const manualInput = document.createElement('input');
        manualInput.type = 'text';
        manualInput.placeholder = t('manual_input_placeholder');
        manualInput.style.display = 'none';
        manualInput.id = modelSelect.id + '-manual';

        // 添加"手动输入"选项
        const manualOption = document.createElement('option');
        manualOption.value = '__manual__';
        manualOption.textContent = t('manual_input_label');
        modelSelect.appendChild(manualOption);

        modelSelect.onchange = function() {
            if (this.value === '__manual__') {
                this.style.display = 'none';
                manualInput.style.display = 'block';
                manualInput.focus();
            }
        };

        // 插入手动输入框
        if (!document.getElementById(manualInput.id)) {
            modelSelect.parentNode.appendChild(manualInput);
        }
    }
}

async function addSource(event) {
    event.preventDefault();

    const data = {
        name: document.getElementById('source-name').value,
        base_url: document.getElementById('source-base-url').value,
        api_key: document.getElementById('source-api-key').value,
        supported_models: sourceModelsList.length > 0 ? sourceModelsList : null
    };

    const result = await apiRequest('source-apis', 'POST', data);
    if (result) {
        showToast(t('source_created'), 'success');
        closeAddSourceModal();
        loadSources();
    }
}

async function loadSources() {
    const response = await apiRequest('source-apis');
    if (!response) return;

    const sources = response.source_apis || [];
    const tbody = document.getElementById('sources-table');

    if (sources.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">' + t('no_data') + '</td></tr>';
        return;
    }

    tbody.innerHTML = sources.map(source => {
        const modelsCount = (source.supported_models || []).length;
        return `
        <tr>
            <td>${escapeHtml(source.name)}</td>
            <td class="font-mono" style="font-size: 12px;">${escapeHtml(source.base_url)}</td>
            <td class="font-mono" style="font-size: 12px;">${maskApiKey(source.api_key)}</td>
            <td><span class="status-badge status-${source.is_active ? 'active' : 'inactive'}">
                ${source.is_active ? t('success') : t('error')}
            </span></td>
            <td>
                <button class="btn btn-sm btn-success" onclick="testSourceApi('${source.source_id}')" style="margin-right: 4px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    ${t('test_source')}
                </button>
                <button class="btn btn-sm btn-secondary" onclick="editSourceApi('${source.source_id}')" style="margin-right: 4px;">${t('edit')}</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSourceApi('${source.source_id}')">${t('delete')}</button>
            </td>
        </tr>
    `}).join('');
}

// 编辑源API
let editingSourceId = null;
let editingSourceModels = [];

async function editSourceApi(sourceId) {
    editingSourceId = sourceId;
    const response = await apiRequest(`source-apis/${sourceId}`);
    if (!response) return;

    document.getElementById('source-name').value = response.name;
    document.getElementById('source-base-url').value = response.base_url;
    document.getElementById('source-api-key').value = response.api_key;
    editingSourceModels = response.supported_models || [];
    sourceModelsList = [...editingSourceModels];
    renderSourceModelTags();

    document.getElementById('add-source-modal').style.display = 'block';
    document.querySelector('#add-source-modal h3').textContent = t('edit_source_api');

    // 初始化 fetch 按钮监听器
    initFetchModelsButton();
}

async function updateSource(event) {
    event.preventDefault();

    const data = {
        name: document.getElementById('source-name').value,
        base_url: document.getElementById('source-base-url').value,
        api_key: document.getElementById('source-api-key').value,
        supported_models: sourceModelsList.length > 0 ? sourceModelsList : null
    };

    const result = await apiRequest(`source-apis/${editingSourceId}`, 'PATCH', data);
    if (result) {
        showToast(t('source_updated'), 'success');
        closeAddSourceModal();
        editingSourceId = null;
        editingSourceModels = [];
        sourceModelsList = [];
        document.querySelector('#add-source-modal h3').textContent = t('add_source_api');
        loadSources();
    }
}

// 表单提交事件处理
document.addEventListener('DOMContentLoaded', function() {
    // 源API表单
    const addSourceForm = document.getElementById('add-source-form');
    if (addSourceForm) {
        addSourceForm.addEventListener('submit', function(e) {
            if (editingSourceId) {
                updateSource(e);
            } else {
                addSource(e);
            }
        });
    }

    // 虚拟模型表单
    const addVirtualModelForm = document.getElementById('add-virtual-model-form');
    if (addVirtualModelForm) {
        addVirtualModelForm.addEventListener('submit', addVirtualModel);
    }

    // 绑定表单
    const addBindingForm = document.getElementById('add-binding-form');
    if (addBindingForm) {
        addBindingForm.addEventListener('submit', addBinding);
    }

    const updateBindingForm = document.getElementById('update-binding-form');
    if (updateBindingForm) {
        updateBindingForm.addEventListener('submit', updateBinding);
    }
});

async function deleteSourceApi(sourceId) {
    if (!confirm(t('confirm_delete_source'))) return;

    const result = await apiRequest(`source-apis/${sourceId}`, 'DELETE');
    if (result) {
        showToast(t('source_deleted'), 'success');
        loadSources();
        loadBindings();
    }
}

// 测试源API连接
async function testSourceApi(sourceId) {
    if (!confirm(t('confirm_test'))) return;

    const btn = event.target.closest('button');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="spinning">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
        </svg> ${t('testing')}`;
    }

    try {
        const result = await apiRequest(`source-apis/${sourceId}/test`, 'POST');
        if (result) {
            if (result.success) {
                showToast(`${t('test_success')}! ${result.message}`, 'success');
            } else {
                showToast(`${t('test_failed')}: ${result.message}`, 'error');
            }
        }
    } catch (error) {
        showToast(`${t('test_failed')}: ${error.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg> ${t('test_source')}`;
        }
    }
}

// 虚拟模型管理
function showAddVirtualModelModal() {
    document.getElementById('add-virtual-model-modal').style.display = 'block';
    document.getElementById('add-virtual-model-form').reset();
}

function closeAddVirtualModelModal() {
    document.getElementById('add-virtual-model-modal').style.display = 'none';
    document.getElementById('add-virtual-model-form').reset();
}

async function addVirtualModel(event) {
    event.preventDefault();

    const data = {
        model_id: document.getElementById('virtual-model-id').value || null,
        name: document.getElementById('virtual-model-name').value,
        description: document.getElementById('virtual-model-description').value
    };

    try {
        const result = await apiRequest('virtual-models', 'POST', data);
        if (result) {
            showToast(t('vm_created'), 'success');
            closeAddVirtualModelModal();
            loadVirtualModels();
        }
    } catch (error) {
        showToast(`${t('create_failed')}: ${error.message}`, 'error');
    }
}

async function loadVirtualModels() {
    const response = await apiRequest('virtual-models');
    if (!response) return;

    const models = response.virtual_models || [];
    const tbody = document.getElementById('virtual-models-table');

    if (models.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">' + t('no_virtual_models_yet') + '</td></tr>';
        return;
    }

    tbody.innerHTML = models.map(model => `
        <tr>
            <td class="font-mono">${escapeHtml(model.model_id)}</td>
            <td>${escapeHtml(model.name)}</td>
            <td>${escapeHtml(model.description || '-')}</td>
            <td><span class="status-badge status-${model.is_active ? 'active' : 'inactive'}">
                ${model.is_active ? t('activated') : t('disabled')}
            </span></td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteVirtualModel('${model.model_id}')">${t('delete')}</button>
            </td>
        </tr>
    `).join('');
}

async function deleteVirtualModel(modelId) {
    if (!confirm(t('confirm_delete_vm'))) return;

    const result = await apiRequest(`virtual-models/${modelId}`, 'DELETE');
    if (result) {
        showToast(t('vm_deleted'), 'success');
        loadVirtualModels();
        loadBindings();
    }
}

// 绑定管理
function showAddBindingModal() {
    document.getElementById('add-binding-modal').style.display = 'block';
    document.getElementById('add-binding-form').reset();
    loadBindingOptions();
}

function closeAddBindingModal() {
    document.getElementById('add-binding-modal').style.display = 'none';
    document.getElementById('add-binding-form').reset();
}

function closeUpdateBindingModal() {
    document.getElementById('update-binding-modal').style.display = 'none';
}

async function loadBindingOptions() {
    // 加载虚拟模型选项（两个下拉框都要加载）
    const vModels = await apiRequest('virtual-models');
    const vSelect1 = document.getElementById('binding-virtual-model');
    const vSelect2 = document.getElementById('update-binding-virtual-model');

    if (vModels) {
        const options = '<option value="">' + t('select_virtual_model') + '</option>' +
            (vModels.virtual_models || []).map(m =>
                `<option value="${m.model_id}">${escapeHtml(m.name)} (${m.model_id})</option>`
            ).join('');

        if (vSelect1) vSelect1.innerHTML = options;
        if (vSelect2) vSelect2.innerHTML = options;
    }

    // 加载源API选项（两个下拉框都要加载）
    const sources = await apiRequest('source-apis');
    const sSelect1 = document.getElementById('binding-source');
    const sSelect2 = document.getElementById('update-binding-source');

    if (sources) {
        const options = '<option value="">' + t('select_source_api') + '</option>' +
            (sources.source_apis || []).map(s =>
                `<option value="${s.source_id}">${escapeHtml(s.name)}</option>`
            ).join('');

        if (sSelect1) sSelect1.innerHTML = options;
        if (sSelect2) sSelect2.innerHTML = options;
    }

    // 为两个源API选择器添加change事件监听器
    if (sSelect1) {
        sSelect1.addEventListener('change', async function() {
            await updateSourceModelOptionsForBinding('binding-source', 'binding-source-model');
        });
    }

    if (sSelect2) {
        sSelect2.addEventListener('change', async function() {
            await updateSourceModelOptionsForBinding('update-binding-source', 'update-binding-source-model');
        });
    }

    // 为两个源模型选择器添加change事件监听器
    const sourceModelSelect1 = document.getElementById('binding-source-model');
    const sourceModelSelect2 = document.getElementById('update-binding-source-model');

    if (sourceModelSelect1) {
        sourceModelSelect1.addEventListener('change', async function() {
            await handleSourceModelChange(this, 'binding-source-model');
        });
    }

    if (sourceModelSelect2) {
        sourceModelSelect2.addEventListener('change', async function() {
            await handleSourceModelChange(this, 'update-binding-source-model');
        });
    }
}

async function updateSourceModelOptionsForBinding(sourceSelectId, modelSelectId) {
    const sourceId = document.getElementById(sourceSelectId)?.value;
    if (!sourceId) return;

    // 获取源API详情
    const sourcesResponse = await apiRequest('source-apis');
    const sources = sourcesResponse?.source_apis || [];
    const source = sources.find(s => s.source_id === sourceId);

    const modelSelect = document.getElementById(modelSelectId);
    if (!modelSelect) return;

    // 移除旧的手动输入框
    const oldManualInput = document.getElementById(modelSelectId + '-manual');
    if (oldManualInput) oldManualInput.remove();

    if (source && source.supported_models && source.supported_models.length > 0) {
        // 使用源API配置中的模型列表
        modelSelect.innerHTML = '<option value="">' + t('select_source_model') + '</option>' +
            source.supported_models.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    } else {
        // 如果没有配置，提供手动输入选项
        modelSelect.innerHTML = '<option value="">' + t('or_manual_input') + '</option>';

        // 添加"手动输入"选项
        const manualOption = document.createElement('option');
        manualOption.value = '__manual__';
        manualOption.textContent = t('manual_input_label');
        modelSelect.appendChild(manualOption);
    }
}

async function handleSourceModelChange(selectElement, baseId) {
    // 检查是否选择了手动输入
    if (selectElement.value === '__manual__') {
        selectElement.style.display = 'none';
        const manualInput = document.getElementById(baseId + '-manual');
        if (manualInput) {
            manualInput.style.display = 'block';
            manualInput.focus();
        }
    }
}

async function addBinding(event) {
    event.preventDefault();

    // 检查是否有手动输入的模型名称
    const sourceModelSelect = document.getElementById('binding-source-model');
    let sourceModelName = sourceModelSelect.value;

    // 检查手动输入框
    const manualInput = document.getElementById('binding-source-model-manual');
    if (manualInput && manualInput.style.display !== 'none' && manualInput.value.trim()) {
        sourceModelName = manualInput.value.trim();
    }

    if (!sourceModelName) {
        showToast(t('select_or_input_model_error'), 'error');
        return;
    }

    const data = {
        virtual_model_id: document.getElementById('binding-virtual-model').value,
        source_id: document.getElementById('binding-source').value,
        source_model_name: sourceModelName,
        priority: parseInt(document.getElementById('binding-priority').value) || 0
    };

    try {
        const result = await apiRequest('model-bindings', 'POST', data);
        if (result) {
            showToast(t('binding_created_success'), 'success');
            closeAddBindingModal();
            loadBindings();
        }
    } catch (error) {
        showToast(`${t('create_failed')}: ${error.message}`, 'error');
    }
}

async function loadBindings() {
    const response = await apiRequest('model-bindings');
    if (!response) return;

    const bindings = response.model_bindings || [];
    const tbody = document.getElementById('bindings-table');

    if (bindings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">' + t('no_bindings_yet') + '</td></tr>';
        return;
    }

    tbody.innerHTML = bindings.map(binding => `
        <tr>
            <td class="font-mono">${escapeHtml(binding.virtual_model_name || binding.virtual_model_id)}</td>
            <td class="font-mono">${escapeHtml(binding.source_name || binding.source_id)}</td>
            <td class="font-mono" style="font-size: 12px;">${escapeHtml(binding.source_model_name)}</td>
            <td>${binding.priority || 0}</td>
            <td><span class="status-badge status-${binding.is_active ? 'active' : 'inactive'}">
                ${binding.is_active ? t('binding_not_active') : t('binding_inactive')}
            </span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editBinding('${binding.binding_id}')">${t('edit')}</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBinding('${binding.binding_id}')">${t('delete')}</button>
            </td>
        </tr>
    `).join('');
}

let currentBindingId = null;

async function editBinding(bindingId) {
    currentBindingId = bindingId;
    document.getElementById('update-binding-modal').style.display = 'block';

    // 加载当前绑定信息
    const binding = await apiRequest(`model-bindings/${bindingId}`);
    if (!binding) return;

    // 加载选项
    await loadBindingOptions();

    // 设置当前值
    document.getElementById('update-binding-virtual-model').value = binding.virtual_model_id;
    document.getElementById('update-binding-source').value = binding.source_id;

    // 触发源模型选项更新
    const sourceSelect = document.getElementById('update-binding-source');
    if (sourceSelect) {
        // 手动触发change事件来更新源模型选项
        const event = new Event('change');
        sourceSelect.dispatchEvent(event);
    }

    // 等待选项更新后设置源模型值
    setTimeout(() => {
        const sourceModelSelect = document.getElementById('update-binding-source-model');
        if (!sourceModelSelect) return;

        // 尝试匹配现有选项
        const options = Array.from(sourceModelSelect.options);
        const matchingOption = options.find(opt => opt.value === binding.source_model_name);

        if (matchingOption) {
            sourceModelSelect.value = binding.source_model_name;
        } else {
            // 没有匹配，使用手动输入
            const manualInput = document.getElementById('update-binding-source-model-manual');
            if (manualInput) {
                manualInput.style.display = 'block';
                manualInput.value = binding.source_model_name;
                manualInput.focus();
                sourceModelSelect.value = '__manual__';
            }
        }
    }, 200);

    document.getElementById('update-binding-priority').value = binding.priority || 0;
}

async function updateBinding(event) {
    event.preventDefault();

    // 检查是否有手动输入的模型名称
    const sourceModelSelect = document.getElementById('update-binding-source-model');
    let sourceModelName = sourceModelSelect.value;

    // 检查手动输入框
    const manualInput = document.getElementById('update-binding-source-model-manual');
    if (manualInput && manualInput.style.display !== 'none' && manualInput.value.trim()) {
        sourceModelName = manualInput.value.trim();
    }

    if (!sourceModelName) {
        showToast(t('select_or_input_model_error'), 'error');
        return;
    }

    const data = {
        virtual_model_id: document.getElementById('update-binding-virtual-model').value,
        source_id: document.getElementById('update-binding-source').value,
        source_model_name: sourceModelName,
        priority: parseInt(document.getElementById('update-binding-priority').value)
    };

    try {
        const result = await apiRequest(`model-bindings/${currentBindingId}`, 'PATCH', data);
        if (result) {
            showToast(t('binding_updated_success'), 'success');
            closeUpdateBindingModal();
            loadBindings();
        }
    } catch (error) {
        showToast(`${t('update_failed')}: ${error.message}`, 'error');
    }
}

async function deleteBinding(bindingId) {
    if (!confirm(t('confirm_delete_binding'))) return;

    const result = await apiRequest(`model-bindings/${bindingId}`, 'DELETE');
    if (result) {
        showToast(t('binding_deleted_success'), 'success');
        loadBindings();
    }
}

// ========================================
// 请求日志
// ========================================
async function clearLogs() {
    if (!confirm(t('confirm_clear_logs'))) return;

    const result = await apiRequest('logs/clear', 'POST', {});
    if (result) {
        showToast(`${t('logs_cleared')}（${t('logs_deleted')}${result.logs_deleted}${t('stats_deleted')}${result.statistics_deleted}）`, 'success');
        loadLogs();
    }
}

async function loadLogs() {
    const keyId = document.getElementById('log-key-id').value;
    const model = document.getElementById('log-model').value;
    const statusSelect = document.getElementById('log-status');
    const status = statusSelect.value;  // 修复：使用正确的值而非 status_code
    const startDate = document.getElementById('log-start-date').value;
    const endDate = document.getElementById('log-end-date').value;

    const params = new URLSearchParams({
        limit: logsLimit,
        offset: logsOffset
    });

    if (keyId) params.append('key_id', keyId);
    if (model) params.append('model', model);
    if (status) params.append('status_code', status);  // 修复：使用 status_code 参数
    if (startDate) params.append('start_date', new Date(startDate).toISOString());
    if (endDate) params.append('end_date', new Date(endDate).toISOString());

    const data = await apiRequest(`logs?${params.toString()}`);
    if (!data) return;

    const logsTable = document.getElementById('logs-table');

    if (!data.logs || data.logs.length === 0) {
        logsTable.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">' + t('no_data') + '</td></tr>';
    } else {
        logsTable.innerHTML = data.logs.map(log => `
            <tr>
                <td>${formatDateTime(log.request_time)}</td>
                <td class="font-mono">${log.client_ip || '-'}</td>
                <td class="font-mono" style="font-size: 12px;">${log.key_id ? log.key_id.substring(0, 16) + '...' : '-'}</td>
                <td class="font-mono">${escapeHtml(log.model)}</td>
                <td>
                    <span class="status-badge ${getStatusClass(log.status_code)}">
                        ${log.status_code || '-'}
                    </span>
                </td>
                <td class="font-mono">
                    ${log.input_tokens || 0} / ${log.output_tokens || 0}
                </td>
                <td>${log.response_time_ms ? log.response_time_ms + 'ms' : '-'}</td>
                <td style="max-width: 200px;" class="text-truncate">${log.error_message || '-'}</td>
            </tr>
        `).join('');
    }

    updateLogsPageInfo();
}

// 导出日志
async function exportLogs() {
    const keyId = document.getElementById('log-key-id').value;
    const model = document.getElementById('log-model').value;
    const status = document.getElementById('log-status').value;
    const startDate = document.getElementById('log-start-date').value;
    const endDate = document.getElementById('log-end-date').value;

    const params = new URLSearchParams();
    if (keyId) params.append('key_id', keyId);
    if (model) params.append('model', model);
    if (status) params.append('status_code', status);
    if (startDate) params.append('start_date', new Date(startDate).toISOString());
    if (endDate) params.append('end_date', new Date(endDate).toISOString());

    try {
        const response = await fetch(`/admin/api/logs/export?${params.toString()}`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        if (!response.ok) {
            throw new Error(t('export_failed'));
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'request_logs.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast(t('logs_exported'), 'success');
    } catch (error) {
        showToast(`${t('export_failed')}: ${error.message}`, 'error');
    }
}

function getStatusClass(statusCode) {
    if (!statusCode) return '';
    if (statusCode >= 200 && statusCode < 300) return 'status-active';
    if (statusCode >= 400 && statusCode < 500) return 'status-warning';
    if (statusCode >= 500) return 'status-danger';
    return '';
}

function resetLogFilters() {
    document.getElementById('logs-filter-form').reset();
    logsOffset = 0;
    loadLogs();
}

function updateLogsPageInfo() {
    const pageNum = Math.floor(logsOffset / logsLimit) + 1;
    document.getElementById('logs-page-info').textContent = `第 ${pageNum} 页`;
}

function prevLogsPage() {
    if (logsOffset > 0) {
        logsOffset -= logsLimit;
        loadLogs();
    }
}

function nextLogsPage() {
    logsOffset += logsLimit;
    loadLogs();
}

// ========================================
// 统计报表
// ========================================
async function loadStatistics() {
    const keyId = document.getElementById('stats-key-id').value;
    const startDate = document.getElementById('stats-start-date').value;
    const endDate = document.getElementById('stats-end-date').value;

    const params = new URLSearchParams();
    if (keyId) params.append('key_id', keyId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const stats = await apiRequest(`statistics?${params.toString()}`);
    if (!stats) return;

    // 总体统计
    const total = stats.total || {};
    const totalTokens = (total.total_input_tokens || 0) + (total.total_output_tokens || 0);
    const activeUsers = stats.by_user?.length || 0;
    const avgRequestsPerUser = activeUsers > 0 ? Math.round(total.total_requests / activeUsers) : 0;

    document.getElementById('total-requests').textContent = formatNumber(total.total_requests || 0);
    document.getElementById('total-input-tokens').textContent = formatNumber(total.total_input_tokens || 0);
    document.getElementById('total-output-tokens').textContent = formatNumber(total.total_output_tokens || 0);
    document.getElementById('total-tokens').textContent = formatNumber(totalTokens);
    document.getElementById('total-errors').textContent = formatNumber(total.total_errors || 0);
    document.getElementById('avg-requests-per-user').textContent = avgRequestsPerUser;

    // 按日期统计
    const dailyStatsTable = document.getElementById('daily-stats-table');
    if (stats.by_date && stats.by_date.length > 0) {
        dailyStatsTable.innerHTML = stats.by_date.map(stat => `
            <tr>
                <td>${stat.date}</td>
                <td>${formatNumber(stat.total_requests)}</td>
                <td class="font-mono">${formatNumber(stat.total_input_tokens)}</td>
                <td class="font-mono">${formatNumber(stat.total_output_tokens)}</td>
                <td>${formatNumber(stat.total_errors)}</td>
            </tr>
        `).join('');
    } else {
        dailyStatsTable.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">' + t('no_data') + '</td></tr>';
    }

    // 按用户统计
    const userStatsTable = document.getElementById('user-stats-table');
    if (stats.by_user && stats.by_user.length > 0) {
        userStatsTable.innerHTML = stats.by_user.map(stat => `
            <tr>
                <td class="font-mono" style="font-size: 12px;">${stat.key_id ? stat.key_id.substring(0, 16) + '...' : t('global_label')}</td>
                <td>${formatNumber(stat.total_requests)}</td>
                <td class="font-mono">${formatNumber(stat.total_input_tokens || 0)}</td>
                <td class="font-mono">${formatNumber(stat.total_output_tokens || 0)}</td>
                <td>${formatNumber(stat.total_errors)}</td>
            </tr>
        `).join('');
    } else {
        userStatsTable.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">' + t('no_data') + '</td></tr>';
    }
}

// ========================================
// 系统设置
// ========================================
async function loadSettings() {
    const config = await apiRequest('config');
    if (!config) return;

    document.getElementById('global-rpm').value = config.rate_limit?.global_rpm || 1000;
    document.getElementById('default-key-rpm').value = config.rate_limit?.default_key_rpm || 60;
}

async function saveRateLimit(event) {
    event.preventDefault();

    const globalRpm = parseInt(document.getElementById('global-rpm').value);
    const defaultKeyRpm = parseInt(document.getElementById('default-key-rpm').value);

    const result = await apiRequest('config', 'POST', {
        rate_limit: {
            global_rpm: globalRpm,
            default_key_rpm: defaultKeyRpm
        }
    });

    if (result) {
        showToast(t('rate_limit_saved'), 'success');
    }
}

let pendingPasswordChange = null;

function changeAdminPassword(event) {
    event.preventDefault();

    const newPassword = document.getElementById('new-admin-password').value;

    if (!newPassword || newPassword.length < 6) {
        showToast(t('password_min_length'), 'warning');
        return;
    }

    // 显示二次确认模态框
    document.getElementById('confirm-new-password').value = newPassword;
    document.getElementById('confirm-current-password').value = '';
    document.getElementById('password-confirm-modal').style.display = 'block';
}

function closePasswordConfirmModal() {
    document.getElementById('password-confirm-modal').style.display = 'none';
    pendingPasswordChange = null;
}

async function confirmPasswordChange() {
    const currentPassword = document.getElementById('confirm-current-password').value;
    const newPassword = document.getElementById('confirm-new-password').value;

    if (!currentPassword) {
        showToast(t('please_enter_current_password'), 'warning');
        return;
    }

    // 验证当前密码
    try {
        const resp = await fetch('/admin/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPassword })
        });

        if (!resp.ok) {
            showToast(t('current_password_wrong'), 'error');
            return;
        }

        const data = await resp.json();
        const token = data.session_token;

        // 当前密码验证通过，修改密码
        const result = await fetch('/admin/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': token
            },
            body: JSON.stringify({ admin_password: newPassword })
        });

        if (result.ok) {
            showToast(t('password_changed'), 'success');
            closePasswordConfirmModal();
            // 清除旧token并刷新
            localStorage.removeItem('sessionToken');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            const error = await result.json();
            showToast(`${t('password_change_failed')}: ${error.detail || t('unknown_error')}`, 'error');
        }
    } catch (error) {
        console.error('Password change error:', error);
        showToast(`${t('password_change_failed')}: ${error.message}`, 'error');
    }
}

// ========================================
// 工具函数
// ========================================
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const locale = currentLang === 'zh' ? 'zh-CN' : 'en-US';
    return date.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const locale = currentLang === 'zh' ? 'zh-CN' : 'en-US';
    return date.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function maskApiKey(key) {
    if (!key || key.length < 16) return '***';
    return key.substring(0, 6) + '...' + key.substring(key.length - 4);
}

// ========================================
// 移动端菜单
// ========================================
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');
    const hamburger = document.getElementById('hamburger-btn');

    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    hamburger.classList.toggle('active');
}

function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');
    const hamburger = document.getElementById('hamburger-btn');

    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    hamburger.classList.remove('active');
}

// ========================================
// 初始化
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // 初始化语言选择器 active 状态
    const savedLang = localStorage.getItem('preferredLanguage') || 'zh';
    currentLang = savedLang;
    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.classList.remove('active');
    });
    const activeOption = document.querySelector(`.lang-option[data-lang="${savedLang}"]`);
    if (activeOption) {
        activeOption.classList.add('active');
    }
    updateLangLabel();

    // 应用当前语言
    applyLanguage();

    // 汉堡菜单
    document.getElementById('hamburger-btn')?.addEventListener('click', toggleMobileMenu);
    document.getElementById('mobile-overlay')?.addEventListener('click', closeMobileMenu);

    // 导航链接点击时关闭移动端菜单
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeMobileMenu();
            }
        });
    });

    // 检查是否已登录
    const savedToken = localStorage.getItem('sessionToken');
    
    if (savedToken) {
        fetch('/admin/api/config', {
            headers: { 'X-Session-Token': savedToken }
        }).then(resp => {
            ('[Session] Server response:', resp.status, resp.ok);
            if (resp.ok) {
                // 验证成功后才设置全局变量并显示主面板
                sessionToken = savedToken;
                ('[Session] Token validated, sessionToken set to:', sessionToken.substring(0, 20) + '...');
                showMainPanel();
            } else {
                // 会话已过期
                ('[Session] Token invalid, clearing localStorage');
                localStorage.removeItem('sessionToken');
                sessionToken = '';
            }
        }).catch(err => {
            ('[Session] Network error:', err);
            // 网络错误，保留token但不显示主面板
            sessionToken = '';
        });
    } else {
        ('[Session] No saved token, showing login page');
    }

    // 登录表单
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const password = document.getElementById('password').value;

            const btn = e.target.querySelector('button[type="submit"]');
            if (!btn) return;

            btn.querySelector('.btn-text').style.display = 'none';
            btn.querySelector('.btn-loading').style.display = 'inline';
            btn.disabled = true;

            const result = await login(password);

            btn.querySelector('.btn-text').style.display = 'inline';
            btn.querySelector('.btn-loading').style.display = 'none';
            btn.disabled = false;

            // 如果登录成功，阻止表单默认行为
            if (result) {
                e.preventDefault();
            }
        });
    }

    // 登出按钮
    document.getElementById('logout-btn').addEventListener('click', logout);

    // 导航链接
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.closest('.nav-link').dataset.page;
            navigateTo(page);
        });
    });

    // 创建密钥
    const createKeyBtn = document.getElementById('create-key-btn');
    if (createKeyBtn) createKeyBtn.addEventListener('click', showCreateKeyForm);
    const newKeyForm = document.getElementById('new-key-form');
    if (newKeyForm) newKeyForm.addEventListener('submit', createKey);

    // 日志相关
    const logsFilterForm = document.getElementById('logs-filter-form');
    if (logsFilterForm) {
        logsFilterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            logsOffset = 0;
            loadLogs();
        });
    }

    // 统计相关
    const statsFilterForm = document.getElementById('stats-filter-form');
    if (statsFilterForm) {
        statsFilterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            loadStatistics();
        });
    }

    // 限流配置
    const rateLimitForm = document.getElementById('rate-limit-form');
    if (rateLimitForm) rateLimitForm.addEventListener('submit', saveRateLimit);

    // 修改密码
    const adminPasswordForm = document.getElementById('admin-password-form');
    if (adminPasswordForm) adminPasswordForm.addEventListener('submit', changeAdminPassword);

    // 编辑密钥表单
    const editKeyForm = document.getElementById('edit-key-form');
    if (editKeyForm) editKeyForm.addEventListener('submit', updateKey);
});

// ========================================
// 数据清理功能
// ========================================

function showCleanupLogsModal() {
    const modal = document.getElementById('cleanup-logs-modal');
    if (modal) {
        modal.style.display = 'block';
        // 确保模态框在最上层
        modal.style.zIndex = '9999';
    } else {
        console.error('cleanup-logs-modal not found');
    }
    // 清空表单
    document.getElementById('cleanup-key-id').value = '';
    document.getElementById('cleanup-model').value = '';
    document.getElementById('cleanup-start-date').value = '';
    document.getElementById('cleanup-end-date').value = '';
    document.getElementById('cleanup-status').value = '';
}

function closeCleanupLogsModal() {
    document.getElementById('cleanup-logs-modal').style.display = 'none';
}

function showCleanupStatsModal() {
    const modal = document.getElementById('cleanup-stats-modal');
    if (modal) {
        modal.style.display = 'block';
        modal.style.zIndex = '9999';
    }
    // 清空表单
    document.getElementById('cleanup-stats-key-id').value = '';
    document.getElementById('cleanup-stats-start-date').value = '';
    document.getElementById('cleanup-stats-end-date').value = '';
}

function closeCleanupStatsModal() {
    document.getElementById('cleanup-stats-modal').style.display = 'none';
}

async function cleanupLogs(event) {
    event.preventDefault();

    const keyId = document.getElementById('cleanup-key-id').value.trim();
    const model = document.getElementById('cleanup-model').value.trim();
    const startDate = document.getElementById('cleanup-start-date').value;
    const endDate = document.getElementById('cleanup-end-date').value;
    const statusFilter = document.getElementById('cleanup-status').value;

    if (!keyId && !model && !startDate && !endDate && !statusFilter) {
        if (!confirm(t('cleanup_all_warning'))) {
            return;
        }
    } else {
        let summary = t('cleanup_summary_prefix') + '\n';
        if (keyId) summary += `- ${t('cleanup_key_prefix')}${keyId}\n`;
        if (model) summary += `- ${t('cleanup_model_prefix')}${model}\n`;
        if (startDate) summary += `- ${t('cleanup_start_prefix')}${startDate}\n`;
        if (endDate) summary += `- ${t('cleanup_end_prefix')}${endDate}\n`;
        if (statusFilter) summary += `- ${t('cleanup_status_prefix')}${statusFilter}\n`;
        if (!confirm(summary + '\n' + t('confirm_cleanup_cond'))) {
            return;
        }
    }

    try {
        const params = new URLSearchParams();
        if (keyId) params.append('key_id', keyId);
        if (model) params.append('model', model);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (statusFilter) params.append('status_filter', statusFilter);

        const result = await apiRequest(`cleanup/logs?${params.toString()}`, 'POST');
        if (result) {
            showToast(`${t('success_cleaned_logs')} ${result.deleted_count} ${t('logs_record_suffix')}`);
            closeCleanupLogsModal();
            loadLogs(); // 刷新日志列表
        }
    } catch (error) {
        showToast(`${t('cleanup_failed_prefix')}${error.message}`, 'error');
    }
}

async function cleanupStats(event) {
    event.preventDefault();

    const keyId = document.getElementById('cleanup-stats-key-id').value.trim();
    const startDate = document.getElementById('cleanup-stats-start-date').value;
    const endDate = document.getElementById('cleanup-stats-end-date').value;

    if (!keyId && !startDate && !endDate) {
        if (!confirm(t('cleanup_all_stats_warning'))) {
            return;
        }
    } else {
        let summary = t('cleanup_summary_prefix') + '\n';
        if (keyId) summary += `- ${t('cleanup_key_prefix')}${keyId}\n`;
        if (startDate) summary += `- ${t('cleanup_start_prefix')}${startDate}\n`;
        if (endDate) summary += `- ${t('cleanup_end_prefix')}${endDate}\n`;
        if (!confirm(summary + '\n' + t('confirm_cleanup_cond'))) {
            return;
        }
    }

    try {
        const params = new URLSearchParams();
        if (keyId) params.append('key_id', keyId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        const result = await apiRequest(`cleanup/statistics?${params.toString()}`, 'POST');
        if (result) {
            showToast(`${t('success_cleaned_logs')} ${result.deleted_count} ${t('stats_record_suffix')}`);
            closeCleanupStatsModal();
            loadStatistics(); // 刷新统计数据
        }
    } catch (error) {
        showToast(`${t('cleanup_failed_prefix')}${error.message}`, 'error');
    }
}

async function cleanupInactiveKeys() {
    if (!confirm(t('confirm_delete_disabled_keys'))) {
        return;
    }

    try {
        const result = await apiRequest('cleanup/inactive-keys', 'POST');
        if (result) {
            showToast(result.deleted_count > 0
                ? t('deleted_keys_count').replace('{count}', result.deleted_count)
                : t('no_disabled_keys'));
            loadKeys(); // 刷新密钥列表
        }
    } catch (error) {
        showToast(`${t('cleanup_failed_prefix')}${error.message}`, 'error');
    }
}

async function cleanupOrphanLogs() {
    if (!confirm(t('confirm_delete_orphan_logs'))) {
        return;
    }

    try {
        const result = await apiRequest('cleanup/orphan-logs', 'POST');
        if (result) {
            showToast(result.deleted_count > 0
                ? t('orphan_logs_count').replace('{count}', result.deleted_count)
                : t('no_orphan_logs'));
            loadLogs(); // 刷新日志列表
        }
    } catch (error) {
        showToast(`${t('cleanup_failed_prefix')}${error.message}`, 'error');
    }
}

// 在DOMContentLoaded中添加表单事件绑定
document.addEventListener('DOMContentLoaded', () => {
    // 清理日志表单
    const logsForm = document.getElementById('cleanup-logs-form');
    if (logsForm) {
        logsForm.addEventListener('submit', cleanupLogs);
    }

    // 清理统计表单
    const statsForm = document.getElementById('cleanup-stats-form');
    if (statsForm) {
        statsForm.addEventListener('submit', cleanupStats);
    }
});
// ========================================
// 实时监控
// ========================================
async function refreshRealtimeStats() {
    const stats = await apiRequest('realtime-stats');
    if (!stats) return;

    document.getElementById('requests-last-minute').textContent = stats.active_requests_last_minute || 0;
    document.getElementById('requests-per-minute').textContent = stats.requests_per_minute_recent || 0;
    document.getElementById('avg-response-recent').textContent = stats.avg_response_time_last_5_minutes 
        ? Math.round(stats.avg_response_time_last_5_minutes) + 'ms' 
        : '--ms';
}

// ========================================
// 数据库备份与恢复
// ========================================
async function backupDatabase() {
    try {
        const result = await apiRequest('database/backup', 'POST');
        if (result) {
            showToast(`${t('backup_file_prefix')}${result.backup_file}`, 'success');
        }
    } catch (error) {
        showToast(`${t('backup_failed_prefix')}${error.message}`, 'error');
    }
}

async function exportDatabase() {
    try {
        const response = await fetch('/admin/api/database/export', {
            headers: { 'X-Session-Token': sessionToken }
        });

        if (!response.ok) {
            throw new Error('Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('content-disposition')?.split('filename=')[1] || 'relay_backup.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast(t('export_success'), 'success');
    } catch (error) {
        showToast(`${t('export_failed_prefix')}${error.message}`, 'error');
    }
}

async function importDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
        showToast(t('select_zip'), 'error');
        return;
    }

    if (!confirm(t('confirm_import'))) {
        event.target.value = '';
        return;
    }

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/admin/api/database/import', {
            method: 'POST',
            headers: { 'X-Session-Token': sessionToken },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Import failed');
        }

        const result = await response.json();
        showToast(t('import_success'), 'success');

        setTimeout(() => {
            window.location.reload();
        }, 2000);
    } catch (error) {
        showToast(`${t('import_failed_prefix')}${error.message}`, 'error');
    } finally {
        event.target.value = '';
    }
}

// ========================================
// 隐私过滤设置
// ========================================
async function loadPrivacySettings() {
    if (!sessionToken) return; // 未登录不加载隐私设置
    
    const config = await apiRequest('config');
    if (!config || !config.privacy_filter) return;

    const privacy = config.privacy_filter;
    document.getElementById('privacy-enabled').checked = privacy.enabled || false;
    document.getElementById('filter-metadata').checked = privacy.filter_metadata !== false;
    document.getElementById('filter-usage-details').checked = privacy.filter_usage_details !== false;
    document.getElementById('filter-provider-info').checked = privacy.filter_provider_info !== false;
    document.getElementById('filter-error-details').checked = privacy.filter_error_details || false;
}

async function savePrivacySettings() {
    const privacyFilter = {
        enabled: document.getElementById('privacy-enabled').checked,
        filter_metadata: document.getElementById('filter-metadata').checked,
        filter_usage_details: document.getElementById('filter-usage-details').checked,
        filter_provider_info: document.getElementById('filter-provider-info').checked,
        filter_error_details: document.getElementById('filter-error-details').checked
    };

    const result = await apiRequest('config', 'POST', {
        privacy_filter: privacyFilter
    });

    if (result) {
        showToast(t('privacy_saved'), 'success');
    }
}

// ========================================
// 模型选择器（从源API获取）
// ========================================
async function fetchAndShowSourceModels() {
    // 如果有 editingSourceId，则使用后端 API 获取模型
    if (editingSourceId) {
        try {
            const response = await apiRequest(`source-apis/${editingSourceId}/models`);
            if (response && response.success) {
                showModelPicker(response.models || []);
            } else {
                showToast(`${t('fetch_models_failed')}: ${response?.message || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            showToast(`${t('fetch_models_failed')}: ${error.message}`, 'error');
        }
        return;
    }

    // 如果没有 editingSourceId，提示用户先保存源 API
    showToast(t('please_save_source_first'), 'warning');
}

function showModelPicker(models) {
    const picker = document.getElementById('source-models-picker');
    const list = document.getElementById('models-picker-list');

    if (models.length === 0) {
        list.innerHTML = `<p style="text-align: center; color: var(--text-muted);">${t('no_models_found')}</p>`;
    } else {
        list.innerHTML = models.map(model => `
            <label style="display: flex; align-items: center; gap: 8px; padding: 8px; cursor: pointer;">
                <input type="checkbox" value="${model.id || model}" class="model-checkbox">
                <span class="font-mono">${model.id || model}</span>
            </label>
        `).join('');
    }

    picker.style.display = 'block';
}

function selectAllModels() {
    document.querySelectorAll('.model-checkbox').forEach(cb => cb.checked = true);
}

function deselectAllModels() {
    document.querySelectorAll('.model-checkbox').forEach(cb => cb.checked = false);
}

function addSelectedModels() {
    const checkboxes = document.querySelectorAll('.model-checkbox:checked');
    const models = Array.from(checkboxes).map(cb => cb.value);

    if (models.length === 0) {
        showToast(t('please_select_models'), 'warning');
        return;
    }

    models.forEach(model => {
        if (!sourceModelsList.includes(model)) {
            sourceModelsList.push(model);
        }
    });

    renderSourceModelTags();
    closeModelPicker();
    showToast(`${t('added_models_count').replace('{count}', models.length)}`, 'success');
}

function closeModelPicker() {
    document.getElementById('source-models-picker').style.display = 'none';
}

// ========================================
// 初始化
// ========================================
// 定时刷新实时监控
setInterval(() => {
    if (currentPage === 'dashboard') {
        refreshRealtimeStats();
    }
}, 30000); // 每30秒刷新一次

// 加载隐私设置
document.addEventListener('DOMContentLoaded', () => {
    loadPrivacySettings();
});
