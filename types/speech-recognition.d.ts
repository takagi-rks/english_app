type SpeechRecognitionResultItem = {
  readonly transcript: string;
  readonly confidence: number;
};

type SpeechRecognitionResultListItem = {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
};

type SpeechRecognitionResultList = {
  readonly length: number;
  item(index: number): SpeechRecognitionResultListItem;
  [index: number]: SpeechRecognitionResultListItem;
};

type SpeechRecognitionEvent = Event & {
  readonly results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEvent = Event & {
  readonly error: string;
  readonly message: string;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}
