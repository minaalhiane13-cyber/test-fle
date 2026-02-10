
export type LevelCategory = 'Primaire' | 'Secondaire (collège)' | 'Secondaire qualifiant';

export type StudentGrade = 
  | 'CP' | 'CE1' | 'CE2' | 'CM1' | 'CM2' | '6AEP'
  | '1AC' | '2AC' | '3AC'
  | 'Tronc Commun' | '1AB' | '2AB';

export type DiagnosticResult = 'Faible' | 'Moyen' | 'Bon';

export type QuestionType = 'littérale' | 'inférentielle' | 'évaluative';

export interface DiagnosticQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  skill: 'repérage' | 'inférence' | 'vocabulaire';
}

export interface ReadingMaterial {
  title: string;
  content: string;
  glossary: { word: string; definition: string }[];
}

export interface ComprehensionQuestion {
  id: number;
  text: string;
  expectedType: QuestionType;
  sampleCorrectAnswer: string;
}

export interface UserResponse {
  questionId: number;
  identifiedType: QuestionType;
  answerText: string;
  feedback?: {
    isValid: boolean;
    explanation: string;
    encouragement: string;
    advice: string;
  };
}

export interface AppState {
  step: 'auth' | 'grade' | 'diagnostic' | 'reading' | 'comprehension' | 'bilan';
  studentCode: string;
  grade: StudentGrade;
  levelCategory: LevelCategory;
  diagnosticScore: number;
  diagnosticResult: DiagnosticResult;
  readingMaterial?: ReadingMaterial;
  comprehensionQuestions: ComprehensionQuestion[];
  userResponses: UserResponse[];
  startTime: number;
  endTime?: number;
}
