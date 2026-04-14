import { useRef, useEffect } from 'react';
import ChatItem from './ChatItem';
import './ChatList.css';

function SearchInput({ value, onChange, onClear, onKeyDown }) {
  return (
    <div className="chat-search">
      <svg className="chat-search__icon" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
      </svg>

      <input
        className="chat-search__input"
        type="text"
        placeholder="Search conversations…"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        aria-label="Search chats"
        autoComplete="off"
        spellCheck="false"
      />

      {/* Clear button — only shows when there's a query */}
      {value && (
        <button
          className="chat-search__clear"
          onClick={onClear}
          aria-label="Clear search"
          type="button"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function NoResults({ query }) {
  return (
    <div className="chat-list__empty">
      <span className="chat-list__empty-icon">🔍</span>
      <p className="chat-list__empty-title">No results for "{query}"</p>
      <p className="chat-list__empty-sub">Try a different name or keyword</p>
    </div>
  );
}

function SectionLabel({ label }) {
  return <div className="chat-list__section-label">{label}</div>;
}

export default function ChatList({
  searchQuery,
  filteredChats,
  selectedId,
  focusedIndex,
  onSearch,
  onClear,
  onSelect,
  onKeyDown,
}) {
  const listRef = useRef(null);

  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('.chat-item');
    items[focusedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  const isSearching = searchQuery.trim().length > 0;
  const directChats = isSearching ? [] : filteredChats.filter(c => c.type === 'direct');
  const groupChats  = isSearching ? [] : filteredChats.filter(c => c.type === 'group');

  return (
    <div className="chat-list">
      <SearchInput
        value={searchQuery}
        onChange={onSearch}
        onClear={onClear}
        onKeyDown={onKeyDown}
      />

      <div
        className="chat-list__scroll"
        ref={listRef}
        role="listbox"
        aria-label="Conversations"
      >
        {/* Search results — flat list */}
        {isSearching && filteredChats.length > 0 && (
          <>
            <SectionLabel label={`${filteredChats.length} result${filteredChats.length > 1 ? 's' : ''}`} />
            {filteredChats.map((chat, i) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={selectedId === chat.id}
                isFocused={focusedIndex === i}
                onClick={onSelect}
              />
            ))}
          </>
        )}

        {isSearching && filteredChats.length === 0 && (
          <NoResults query={searchQuery} />
        )}

        {/* Sectioned list when not searching */}
        {!isSearching && (
          <>
            {directChats.length > 0 && (
              <>
                <SectionLabel label="Active Now" />
                {directChats.map((chat, i) => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    isActive={selectedId === chat.id}
                    // Fix: direct chats occupy indices 0..directChats.length-1
                    isFocused={focusedIndex === i}
                    onClick={onSelect}
                  />
                ))}
              </>
            )}

            {groupChats.length > 0 && (
              <>
                <SectionLabel label="Groups" />
                {groupChats.map((chat, i) => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    isActive={selectedId === chat.id}
                    // Fix: group chats continue the index after direct chats
                    isFocused={focusedIndex === i + directChats.length}
                    onClick={onSelect}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}