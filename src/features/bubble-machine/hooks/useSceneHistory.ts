import { useCallback, useEffect, useRef, useState } from 'react';
import type { ElementItem, HistorySnapshot, ReferenceImageItem, TextItem } from '../types';
import { deepClone } from '../utils/math';

type ResetInteractionState = () => void;

export const useSceneHistory = ({
  onResetInteractions,
}: {
  onResetInteractions: ResetInteractionState;
}) => {
  const [elements, setElements] = useState<ElementItem[]>([]);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [referenceImages, setReferenceImages] = useState<ReferenceImageItem[]>([]);
  const [history, setHistory] = useState<HistorySnapshot[]>([{ elements: [], textItems: [], referenceImages: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const historyIndexRef = useRef(0);
  const elementsRef = useRef<ElementItem[]>([]);
  const textItemsRef = useRef<TextItem[]>([]);
  const referenceImagesRef = useRef<ReferenceImageItem[]>([]);
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

  useEffect(() => {
    referenceImagesRef.current = referenceImages;
  }, [referenceImages]);

  const buildHistorySnapshot = useCallback((currentElements = elementsRef.current, currentTextItems = textItemsRef.current, currentReferenceImages = referenceImagesRef.current): HistorySnapshot => ({
    elements: deepClone(currentElements),
    textItems: deepClone(currentTextItems),
    referenceImages: deepClone(currentReferenceImages),
  }), []);

  const saveToHistory = useCallback((scene?: { elements?: ElementItem[]; textItems?: TextItem[]; referenceImages?: ReferenceImageItem[] }) => {
    setHistory((prev) => {
      const currentIndex = historyIndexRef.current;
      const sliced = prev.slice(0, currentIndex + 1);
      const snapshot = buildHistorySnapshot(scene?.elements ?? elementsRef.current, scene?.textItems ?? textItemsRef.current, scene?.referenceImages ?? referenceImagesRef.current);
      const last = sliced[sliced.length - 1] || [];
      if (JSON.stringify(last) === JSON.stringify(snapshot)) return prev;
      const nextHistory = [...sliced, snapshot];
      const nextIndex = nextHistory.length - 1;
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      return nextHistory;
    });
  }, [buildHistorySnapshot]);

  const commitScene = useCallback((nextElements: ElementItem[], nextTextItems: TextItem[], nextReferenceImages: ReferenceImageItem[], options?: { saveHistory?: boolean }) => {
    setElements(nextElements);
    setTextItems(nextTextItems);
    setReferenceImages(nextReferenceImages);
    elementsRef.current = nextElements;
    textItemsRef.current = nextTextItems;
    referenceImagesRef.current = nextReferenceImages;
    if (options?.saveHistory === false) {
      hasPendingHistoryRef.current = true;
      return;
    }
    saveToHistory({ elements: nextElements, textItems: nextTextItems, referenceImages: nextReferenceImages });
    hasPendingHistoryRef.current = false;
  }, [saveToHistory]);

  const commitElements = useCallback((next: ElementItem[], options?: { saveHistory?: boolean }) => {
    commitScene(next, textItemsRef.current, referenceImagesRef.current, options);
  }, [commitScene]);

  const commitTextItems = useCallback((next: TextItem[], options?: { saveHistory?: boolean }) => {
    commitScene(elementsRef.current, next, referenceImagesRef.current, options);
  }, [commitScene]);

  const commitReferenceImages = useCallback((next: ReferenceImageItem[], options?: { saveHistory?: boolean }) => {
    commitScene(elementsRef.current, textItemsRef.current, next, options);
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

  const applyInteractiveReferenceImages = useCallback((producer: (prev: ReferenceImageItem[]) => ReferenceImageItem[]) => {
    setReferenceImages((prev) => {
      const next = producer(prev);
      referenceImagesRef.current = next;
      hasPendingHistoryRef.current = true;
      return next;
    });
  }, []);

  const restoreSnapshot = useCallback((snapshot: HistorySnapshot) => {
    const nextElements = deepClone(snapshot.elements);
    const nextTextItems = deepClone(snapshot.textItems);
    const nextReferenceImages = deepClone(snapshot.referenceImages ?? []);
    setElements(nextElements);
    setTextItems(nextTextItems);
    setReferenceImages(nextReferenceImages);
    elementsRef.current = nextElements;
    textItemsRef.current = nextTextItems;
    referenceImagesRef.current = nextReferenceImages;
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
    restoreSnapshot(history[nextIndex] || { elements: [], textItems: [], referenceImages: [] });
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
    restoreSnapshot(history[nextIndex] || { elements: [], textItems: [], referenceImages: [] });
  }, [history, restoreSnapshot, saveToHistory]);

  const initializeScene = useCallback((snapshot: HistorySnapshot) => {
    const nextElements = deepClone(snapshot.elements);
    const nextTextItems = deepClone(snapshot.textItems);
    const nextReferenceImages = deepClone(snapshot.referenceImages ?? []);
    setElements(nextElements);
    setTextItems(nextTextItems);
    setReferenceImages(nextReferenceImages);
    elementsRef.current = nextElements;
    textItemsRef.current = nextTextItems;
    referenceImagesRef.current = nextReferenceImages;
    setHistory([{ elements: deepClone(nextElements), textItems: deepClone(nextTextItems), referenceImages: deepClone(nextReferenceImages) }]);
    setHistoryIndex(0);
    historyIndexRef.current = 0;
    hasPendingHistoryRef.current = false;
  }, [buildHistorySnapshot]);

  return {
    elements,
    textItems,
    referenceImages,
    history,
    historyIndex,
    setElements,
    setTextItems,
    setReferenceImages,
    elementsRef,
    textItemsRef,
    referenceImagesRef,
    historyIndexRef,
    hasPendingHistoryRef,
    saveToHistory,
    commitScene,
    commitElements,
    commitTextItems,
    commitReferenceImages,
    applyInteractiveElements,
    applyInteractiveTextItems,
    applyInteractiveReferenceImages,
    initializeScene,
    undo,
    redo,
  };
};
