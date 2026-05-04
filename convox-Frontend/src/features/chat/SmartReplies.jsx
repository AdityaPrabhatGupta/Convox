export default function SmartReplies({
  replies = [],
  loading = false,
  onSelect,
  onDismiss,
}) {
  if (!loading && replies.length === 0) return null;

  return (
    <div className="smart-replies">
      {loading ? (
        <>
          <div className="smart-reply-chip smart-reply-chip--skeleton" />
          <div className="smart-reply-chip smart-reply-chip--skeleton" />
          <div className="smart-reply-chip smart-reply-chip--skeleton" />
        </>
      ) : (
        <>
          {replies.map((reply, index) => (
            <button
              key={`${reply}-${index}`}
              type="button"
              className="smart-reply-chip"
              onClick={() => onSelect?.(reply)}
              title={reply}
            >
              {reply}
            </button>
          ))}
          {/* Dismiss button */}
          <button
            type="button"
            className="smart-reply-chip smart-reply-chip--dismiss"
            onClick={onDismiss}
            aria-label="Dismiss suggestions"
            title="Dismiss suggestions"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
