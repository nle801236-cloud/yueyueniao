import { useCallback, useEffect, useRef, useState } from 'react';
import type { ElementItem, HistorySnapshot, TextItem } from '../types';
import { deepClone } from '../utils/math';

type ResetInteractionState = () => void;

export const useSceneHistory = ({
  onResetInteractions,
}: {
  onResetInteractions: ResetInteractionState;
}) => {
  const [elements, setElements] = useState<ElementItem[]>([]);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [history, setHistory] = useState<HistorySnapshot[]>([{ elements: [], textItems: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const historyIndexRef = useRef(0);
  const elementsRef = useRef<ElementItem[]>([]);
  const textItemsRef = useRef<TextItem[]>([]);
  const hasPendingHistoryRef = useRef(false);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    textItemsRef.current = textItems;
  }, [textItems]);

  const buildHistorySnapshot = useCallback((currentElements = elementsRef.current, currentTextItems = textItemsRef.current): HistorySnapshot => ({
    elements: deepClone(currentElements),
    textItems: deepClone(currentTextItems),
  }), []);

  const saveToHistory = useCallback((scene?: { elements?: ElementItem[]; textItems?: TextItem[] }) => {
    setHistory((prev) => {
      const currentIndex = historyIndexRef.current;
      const sliced = prev.slice(0, currentIndex + 1);
      const snapshot = buildHistorySnapshot(scene?.elements ?? elementsRef.current, scene?.textItems ?? textItemsRef.current);
      const last = sliced[sliced.length - 1] || [];
      if (JSON.stringify(last) === JSON.stringify(snapshot)) return prev;
      const nextHistory = [...sliced, snapshot];
      const nextIndex = nextHistory.length - 1;
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      return nextHistory;
    });
  }, [buildHistorySnapshot]);

  const commitScene = useCallback((nextElements: ElementItem[], nextTextItems: TextItem[], options?: { saveHistory?: boolean }) => {
    setElements(nextElements);
    setTextItems(nextTextItems);
    elementsRef.current = nextElements;
    textItemsRef.current = nextTextItems;
    if (options?.saveHistory === false) {
      hasPendingHistoryRef.current = true;
      return;
    }
    saveToHistory({ elements: nextElements, textItems: nextTextItems });
    hasPendingHistoryRef.current = false;
  }, [saveToHistory]);

  const commitElements = useCallback((next: ElementItem[], options?: { saveHistory?: boolean }) => {
    commitScene(next, textItemsRef.current, options);
  }, [commitScene]);

  const commitTextItems = useCallback((next: TextItem[], options?: { saveHistory?: boolean }) => {
    commitScene(elementsRef.current, next, options);
  }, [commitScene]);

  const applyInteractiveElements = useCallback((producer: (prev: ElementItem[]) => ElementItem[]) => {
    setElements((prev) => {
      const next = producer(prev);
      elementsRef.current = next;
      hasPendingHistoryRef.current = true;
      return next;
    });
  }, []);

  const applyInteractiveTextItems = useCallback((producer: (prev: TextItem[]) => TextItem[]) => {
    setTextItems((prev) => {
      const next = producer(prev);
      textItemsRef.current = next;
      hasPendingHistoryRef.current = true;
      return next;
    });
  }, []);

  const restoreSnapshot = useCallback((snapshot: HistorySnapshot) => {
    const nextElements = deepClone(snapshot.elements);
    const nextTextItems = deepClone(snapshot.textItems);
    setElements(nextElements);
    setTextItems(nextTextItems);
    elementsRef.current = nextElements;
    textItemsRef.current = nextTextItems;
    onResetInteractions();
  }, [onResetInteractions]);

  const undo = useCallback(() => {
    if (hasPendingHistoryRef.current) {
      saveToHistory({ elements: elementsRef.current, textItems: textItemsRef.current });
      hasPendingHistoryRef.current = false;
    }
    const currentIndex = historyIndexRef.current;
    if (currentIndex <= 0) return;
    const nextIndex = currentIndex - 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    restoreSnapshot(history[nextIndex] || { elements: [], textItems: [] });
  }, [history, restoreSnapshot, saveToHistory]);

  const redo = useCallback(() => {
    if (hasPendingHistoryRef.current) {
      saveToHistory({ elements: elementsRef.current, textItems: textItemsRef.current });
      hasPendingHistoryRef.current = false;
    }
    const currentIndex = historyIndexRef.current;
    if (currentIndex >= history.length - 1) return;
    const nextIndex = currentIndex + 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    restoreSnapshot(history[nextIndex] || { elements: [], textItems: [] });
  }, [history, restoreSnapshot, saveToHistory]);

  const initializeScene = useCallback((snapshot: HistorySnapshot) => {
    const nextElements = deepClone(snapshot.elements);
    const nextTextItems = deepClone(snapshot.textItems);
    setElements(nextElements);
    setTextItems(nextTextItems);
    elementsRef.current = nextElements;
    textItemsRef.current = nextTextItems;
    setHistory([{ elements: deepClone(nextElements), textItems: deepClone(nextTextItems) }]);
    setHistoryIndex(0);
    historyIndexRef.current = 0;
    hasPendingHistoryRef.current = false;
  }, [buildHistorySnapshot]);

  return {
    elements,
    textItems,
    history,
    historyIndex,
    setElements,
    setTextItems,
    elementsRef,
    textItemsRef,
    historyIndexRef,
    hasPendingHistoryRef,
    saveToHistory,
    commitScene,
    commitElements,
    commitTextItems,
    applyInteractiveElements,
    applyInteractiveTextItems,
    initializeScene,
    undo,
    redo,
  };
};
