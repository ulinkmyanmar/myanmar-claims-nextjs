'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DatabaseManagementClient() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. 处理文件选择与预览请求
  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/database-sync/preview', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setPreviewData(data); // 仅存储预览数据，数据库尚未改变
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to parse file preview.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An error occurred during preview.' });
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 处理确认同步请求（关键：同步完成后执行 router.refresh()）
  const handleConfirm = async () => {
    if (!previewData || !previewData.records) return;

    setIsSyncing(true);
    setMessage(null);

    try {
      const res = await fetch('/api/database-sync/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file?.name,
          records: previewData.records,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Database synced successfully!' });
        setPreviewData(null);
        setFile(null);

        // 核心步骤：触发页面重载与 Stats 数据自动更新
        router.refresh();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to sync database.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An error occurred during sync.' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-md ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 文件上传与预览表单 */}
      <form onSubmit={handlePreview} className="space-y-4">
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full border border-gray-300 rounded-md p-2"
        />
        <button
          type="submit"
          disabled={!file || isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-400"
        >
          {isLoading ? 'Parsing...' : 'Upload & Preview'}
        </button>
      </form>

      {/* 预览结果与确认同步区域 */}
      {previewData && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="font-bold text-lg">Data Preview</h3>
          <p className="text-sm text-gray-600">
            Records found: {previewData.records?.length || 0}
          </p>

          <button
            onClick={handleConfirm}
            disabled={isSyncing}
            className="px-4 py-2 bg-green-600 text-white rounded-md disabled:bg-gray-400"
          >
            {isSyncing ? 'Syncing to Database...' : 'Confirm & Sync'}
          </button>
        </div>
      )}
    </div>
  );
}
