import React, { useRef, useState, useEffect } from 'react';

/**
 * TopScrollbar Component
 * Provides a top horizontal scrollbar synchronized with a target overflow container (table)
 */
const TopScrollbar = ({ tableRef, dependencies = [] }) => {
  const topScrollRef = useRef(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const isSyncingTop = useRef(false);
  const isSyncingTable = useRef(false);

  useEffect(() => {
    const tableEl = tableRef.current;
    if (!tableEl) return;

    const updateWidth = () => {
      setScrollWidth(tableEl.scrollWidth);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(() => updateWidth());
    resizeObserver.observe(tableEl);

    const handleTableScroll = () => {
      if (isSyncingTop.current) {
        isSyncingTop.current = false;
        return;
      }
      if (topScrollRef.current && tableEl) {
        isSyncingTable.current = true;
        topScrollRef.current.scrollLeft = tableEl.scrollLeft;
      }
    };

    tableEl.addEventListener('scroll', handleTableScroll);

    return () => {
      resizeObserver.disconnect();
      tableEl.removeEventListener('scroll', handleTableScroll);
    };
  }, [tableRef, ...dependencies]);

  const handleTopScroll = () => {
    if (isSyncingTable.current) {
      isSyncingTable.current = false;
      return;
    }
    if (topScrollRef.current && tableRef.current) {
      isSyncingTop.current = true;
      tableRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  if (!scrollWidth || (tableRef.current && scrollWidth <= tableRef.current.clientWidth)) {
    return null;
  }

  return (
    <div
      ref={topScrollRef}
      onScroll={handleTopScroll}
      className="overflow-x-auto border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 rounded-t-3xl"
      style={{ height: '14px' }}
    >
      <div style={{ width: `${scrollWidth}px`, height: '1px' }} />
    </div>
  );
};

export default TopScrollbar;
