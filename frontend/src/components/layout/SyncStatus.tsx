import { useSyncStore } from '../../stores/syncStore'

export default function SyncStatus() {
  const { lastSyncSuccess, pendingCount } = useSyncStore()

  const minutesAgo = lastSyncSuccess
    ? Math.floor((Date.now() - new Date(lastSyncSuccess).getTime()) / 60000)
    : null

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className={`h-2 w-2 rounded-full ${lastSyncSuccess ? 'bg-green-400' : 'bg-yellow-400'}`} />
      <span>
        {lastSyncSuccess
          ? minutesAgo === 0
            ? '刚刚同步'
            : `上次同步: ${minutesAgo}分钟前`
          : '未同步'}
      </span>
      {pendingCount > 0 && (
        <span className="text-yellow-400">({pendingCount} 待同步)</span>
      )}
    </div>
  )
}
