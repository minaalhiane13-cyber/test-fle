
import React, { useState } from 'react';
import Layout from './components/Layout';
import { 
  AppState, 
  LevelCategory, 
  StudentGrade, 
  DiagnosticQuestion, 
  DiagnosticResult, 
  UserResponse,
  QuestionType 
} from './types';
import { generateDiagnostic, generateReadingSession, getFeedback } from './services/gemini';
import { User, GraduationCap, ClipboardCheck, BookOpen, CheckCircle, Download, RefreshCw, AlertCircle, ArrowLeft, MessageSquareQuote, Star, Award, Zap, Trophy, Lightbulb, LogOut, FileText, CheckCircle2, XCircle, ArrowUpCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const App: React.FC = () => {
  const initialState: AppState = {
    step: 'auth',
    studentCode: '',
    grade: 'CP',
    levelCategory: 'Primaire',
    diagnosticScore: 0,
    diagnosticResult: 'Moyen',
    comprehensionQuestions: [],
    userResponses: [],
    startTime: Date.now(),
  };

  const [state, setState] = useState<AppState>(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Diagnostic logic
  const [diagQuestions, setDiagQuestions] = useState<DiagnosticQuestion[]>([]);
  const [currentDiagIdx, setCurrentDiagIdx] = useState(0);

  // Comprehension logic
  const [currentCompIdx, setCurrentCompIdx] = useState(0);
  const [currentCompType, setCurrentCompType] = useState<QuestionType | ''>('');
  const [currentCompAnswer, setCurrentCompAnswer] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const calculateScoreValue = () => {
    let totalScore = 0;
    state.userResponses.forEach(r => {
      const q = state.comprehensionQuestions.find(cq => cq.id === r.questionId);
      if (r.feedback?.isValid) {
        if (q?.expectedType === 'littérale') totalScore += 4;
        else if (q?.expectedType === 'inférentielle') totalScore += 4;
        else if (q?.expectedType === 'évaluative') totalScore += 2;
      }
    });
    return totalScore;
  };

  const getStatusForType = (type: QuestionType) => {
    const response = state.userResponses.find(r => {
      const q = state.comprehensionQuestions.find(cq => cq.id === r.questionId);
      return q?.expectedType === type;
    });
    return response?.feedback?.isValid;
  };

  const getEducationalSynthesis = () => {
    const literalOk = getStatusForType('littérale');
    const inferentialOk = getStatusForType('inférentielle');
    const evaluativeOk = getStatusForType('évaluative');

    if (literalOk && inferentialOk && evaluativeOk) {
      return {
        title: "Félicitations ! Maîtrise Totale",
        content: "Tu as parfaitement compris le texte sous tous ses angles. Tu maîtrises le repérage d'informations, l'interprétation du sens caché et l'expression de ton opinion.",
        suggestion: "Conseil : Tu es prêt à relever un défi plus grand. Je te suggère de passer au niveau scolaire supérieur pour ta prochaine séance !"
      };
    }

    let lessons = [];
    if (!literalOk) lessons.push("NIVEAU LITTÉRAL : La réponse est écrite dans le texte. Pour réussir, tu dois relire attentivement et repérer les mots-clés de la question dans les paragraphes.");
    if (!inferentialOk) lessons.push("NIVEAU INFÉRENTIEL : La réponse n'est pas écrite directement. Tu dois devenir un détective : utilise les indices du texte et ta logique pour deviner ce que l'auteur veut dire.");
    if (!evaluativeOk) lessons.push("NIVEAU ÉVALUATIF : On te demande ton avis. Utilise des expressions comme 'À mon avis' ou 'Je pense que' et justifie toujours ta réponse en expliquant pourquoi.");

    return {
      title: "Analyse de tes compétences",
      content: lessons.join("\n\n"),
      suggestion: "Continue tes efforts sur les points mentionnés ci-dessus pour progresser."
    };
  };

  const handleResetSession = async () => {
    setError(null);
    setCurrentCompIdx(0);
    setCurrentCompType('');
    setCurrentCompAnswer('');
    await startReadingSession(state.grade, state.diagnosticResult);
    setState(prev => ({
      ...prev,
      userResponses: [],
      startTime: Date.now(),
    }));
  };

  const handleFullExit = () => {
    setState(initialState);
    setDiagQuestions([]);
    setCurrentDiagIdx(0);
    setCurrentCompIdx(0);
    setCurrentCompType('');
    setCurrentCompAnswer('');
    setError(null);
  };

  const handleBack = () => {
    setError(null);
    if (state.step === 'grade') {
      setState(prev => ({ ...prev, step: 'auth' }));
    } else if (state.step === 'diagnostic' || state.step === 'comprehension') {
      setState(prev => ({ ...prev, step: 'grade' }));
      setCurrentDiagIdx(0);
      setDiagQuestions([]);
    }
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const code = state.studentCode.trim().toUpperCase();
    const primaryRegex = /^P\d{1,4}$/;
    const middleRegex = /^S\d{1,4}$/;
    const highRegex = /^SQ\d{1,4}$/;

    if (primaryRegex.test(code) || middleRegex.test(code) || highRegex.test(code)) {
      let cat: LevelCategory = 'Primaire';
      if (middleRegex.test(code)) cat = 'Secondaire (collège)';
      if (highRegex.test(code)) cat = 'Secondaire qualifiant';
      setState(prev => ({ ...prev, step: 'grade', levelCategory: cat, studentCode: code, diagnosticScore: 0 }));
      setError(null);
    } else {
      setError("Format invalide (P123, S45, SQ89).");
    }
  };

  const handleGradeSelect = async (g: StudentGrade) => {
    setIsLoading(true);
    setError(null);
    try {
      const q = await generateDiagnostic(g);
      setDiagQuestions(q);
      setState(prev => ({ ...prev, grade: g, step: 'diagnostic' }));
    } catch (err) {
      setError("Erreur de connexion avec l'IA.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiagAnswer = (idx: number) => {
    const isCorrect = idx === diagQuestions[currentDiagIdx].correctIndex;
    const newScore = isCorrect ? state.diagnosticScore + 1 : state.diagnosticScore;
    if (currentDiagIdx < diagQuestions.length - 1) {
      setState(prev => ({ ...prev, diagnosticScore: newScore }));
      setCurrentDiagIdx(prev => prev + 1);
    } else {
      let result: DiagnosticResult = 'Moyen';
      if (newScore <= 1) result = 'Faible';
      else if (newScore >= 4) result = 'Bon';
      setState(prev => ({ ...prev, diagnosticScore: newScore, diagnosticResult: result }));
      startReadingSession(state.grade, result);
    }
  };

  const startReadingSession = async (grade: StudentGrade, result: DiagnosticResult) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await generateReadingSession(grade, result);
      setState(prev => ({ 
        ...prev, 
        step: 'comprehension',
        diagnosticResult: result, 
        readingMaterial: data.reading,
        comprehensionQuestions: data.questions
      }));
    } catch (err) {
      setError("Erreur lors de la préparation du texte.");
    } finally {
      setIsLoading(false);
    }
  };

  const submitComprehensionResponse = async () => {
    if (!currentCompType || !currentCompAnswer.trim()) {
      setError("Tu dois identifier le type et écrire ta réponse.");
      return;
    }
    setError(null);
    setIsSubmittingFeedback(true);
    try {
      const question = state.comprehensionQuestions[currentCompIdx];
      const feedback = await getFeedback(
        state.grade,
        state.readingMaterial?.content || '',
        question.text,
        question.expectedType,
        currentCompType as QuestionType,
        currentCompAnswer
      );
      const newResponse: UserResponse = {
        questionId: question.id,
        identifiedType: currentCompType as QuestionType,
        answerText: currentCompAnswer,
        feedback
      };
      setState(prev => ({
        ...prev,
        userResponses: [...prev.userResponses, newResponse]
      }));
    } catch (err) {
      setError("L'analyse a échoué.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const nextQuestion = () => {
    if (currentCompIdx < state.comprehensionQuestions.length - 1) {
      setCurrentCompIdx(prev => prev + 1);
      setCurrentCompType('');
      setCurrentCompAnswer('');
      document.getElementById('questions-section')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setState(prev => ({ ...prev, step: 'bilan', endTime: Date.now() }));
    }
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF();
      const { studentCode, grade, readingMaterial, userResponses, startTime, endTime } = state;
      const duration = Math.round(((endTime || Date.now()) - startTime) / 60000);
      const score = calculateScoreValue();
      const synthesis = getEducationalSynthesis();

      doc.setFontSize(26);
      doc.setTextColor(124, 58, 237);
      doc.text("BILAN LECTIA - FLE", 20, 30);
      
      doc.setDrawColor(124, 58, 237);
      doc.setLineWidth(1);
      doc.line(20, 35, 190, 35);

      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(`Note Finale : ${score} / 10`, 20, 50);
      
      doc.setFontSize(12);
      doc.setTextColor(71, 85, 105);
      doc.text(`Code : ${studentCode} | Classe : ${grade} | Temps : ${duration} min`, 20, 60);

      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(`Titre : ${readingMaterial?.title}`, 20, 75);
      
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      const splitText = doc.splitTextToSize(readingMaterial?.content || "", 170);
      doc.text(splitText, 20, 85);

      const tableData = userResponses.map((r, i) => {
        const q = state.comprehensionQuestions[i];
        return [
          q?.expectedType || "-",
          q?.text || "-",
          r.answerText,
          q?.sampleCorrectAnswer || "-",
          r.feedback?.isValid ? "Correct" : "Erreur"
        ];
      });

      autoTable(doc, {
        startY: 135,
        head: [['Type', 'Question', 'Ta Réponse', 'Modèle Attendu', 'Statut']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [124, 58, 237], fontSize: 9 },
        styles: { fontSize: 7, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 45 },
          2: { cellWidth: 45 },
          3: { cellWidth: 40 },
          4: { cellWidth: 15 }
        }
      });

      // Page de synthèse et leçons
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.setTextColor(124, 58, 237);
      doc.text(synthesis.title, 20, finalY);

      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      const synthContent = doc.splitTextToSize(synthesis.content, 170);
      doc.text(synthContent, 20, finalY + 10);

      doc.setFontSize(11);
      doc.setTextColor(185, 28, 28); // Rouge pour l'alerte/suggestion
      const synthSug = doc.splitTextToSize(synthesis.suggestion, 170);
      doc.text(synthSug, 20, finalY + 10 + (synthContent.length * 5) + 5);

      doc.save(`Bilan_Lectia_${studentCode}.pdf`);
    } catch (err) {
      alert("Erreur lors de la création du PDF.");
    }
  };

  const grades: Record<LevelCategory, StudentGrade[]> = {
    'Primaire': ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6AEP'],
    'Secondaire (collège)': ['1AC', '2AC', '3AC'],
    'Secondaire qualifiant': ['Tronc Commun', '1AB', '2AB'],
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <RefreshCw className="w-12 h-12 text-violet-600 animate-spin" />
          <p className="text-slate-700 font-black">L'IA prépare ta séance de lecture...</p>
        </div>
      </Layout>
    );
  }

  const synthesis = state.step === 'bilan' ? getEducationalSynthesis() : null;

  return (
    <Layout 
      title={state.step === 'auth' ? "Bienvenue sur LECTIA" : undefined}
      subtitle={state.step === 'auth' ? "Améliore ta compréhension de l'écrit avec ton tuteur IA." : undefined}
    >
      {state.step !== 'auth' && state.step !== 'bilan' && (
        <button onClick={handleBack} className="mb-4 flex items-center gap-2 text-slate-400 hover:text-violet-600 font-black uppercase tracking-widest text-[10px]">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
      )}

      {/* STEP: AUTH */}
      {state.step === 'auth' && (
        <div className="max-w-md mx-auto py-4 space-y-6">
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block ml-1">Ton Code Élève</label>
              <input 
                type="text" 
                placeholder="Ex: P245, S87"
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-violet-600 transition-all text-lg font-black text-slate-900 placeholder:text-slate-300"
                value={state.studentCode}
                onChange={(e) => setState(prev => ({ ...prev, studentCode: e.target.value }))}
                required
              />
            </div>
            {error && <p className="text-red-500 text-[11px] font-bold bg-red-50 p-3 rounded-xl">{error}</p>}
            <button type="submit" className="w-full bg-violet-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-violet-700 transition-all flex items-center justify-center gap-2">
              Commencer <Zap className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* STEP: GRADE */}
      {state.step === 'grade' && (
        <div className="space-y-8 py-2 text-center">
          <h3 className="text-xl font-black text-slate-800">Quelle est ta classe ?</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {grades[state.levelCategory].map(g => (
              <button 
                key={g}
                onClick={() => handleGradeSelect(g)}
                className="p-5 bg-white border-2 border-slate-50 hover:border-violet-600 hover:bg-violet-50 rounded-xl transition-all text-center font-black text-slate-700"
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP: DIAGNOSTIC */}
      {state.step === 'diagnostic' && diagQuestions.length > 0 && (
        <div className="space-y-6 py-2">
          <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
             <span>Diagnostic</span>
             <span>Question {currentDiagIdx + 1} / 5</span>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100">
            <h4 className="text-lg font-black text-slate-800 mb-6">{diagQuestions[currentDiagIdx].question}</h4>
            <div className="grid grid-cols-1 gap-3">
              {diagQuestions[currentDiagIdx].options.map((opt, i) => (
                <button 
                  key={i}
                  onClick={() => handleDiagAnswer(i)}
                  className="w-full text-left p-4 bg-white hover:bg-violet-600 hover:text-white border border-slate-200 rounded-xl transition-all font-bold text-slate-700 text-sm"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP: COMPREHENSION */}
      {state.step === 'comprehension' && state.readingMaterial && (
        <div className="space-y-10">
          <section className="space-y-6 relative">
            <h3 className="text-2xl font-black text-slate-800 text-center underline decoration-violet-500 underline-offset-8">
              {state.readingMaterial.title}
            </h3>
            <div className="bg-white p-6 md:p-10 rounded-2xl border-2 border-slate-50 shadow-sm text-lg leading-relaxed text-slate-700 font-medium">
              {state.readingMaterial.content?.split('\n').map((p, i) => p.trim() && <p key={i} className="mb-6">{p}</p>)}
              <div className="text-right mt-6">
                 <span className="text-[10px] text-slate-400 font-bold italic">Source : texte rédigé par l'IA</span>
              </div>
            </div>
            <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <h4 className="col-span-full text-orange-800 font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Glossaire
              </h4>
              {state.readingMaterial.glossary?.map((item, i) => (
                <div key={i} className="text-sm">
                  <span className="font-black text-orange-700">{item.word} :</span> <span className="text-slate-600">{item.definition}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="questions-section" className="pt-8 border-t border-dashed border-slate-200">
            <div className="bg-slate-50 p-8 rounded-3xl border-2 border-violet-50 relative overflow-hidden">
              <div className="mb-4 text-[10px] font-black text-violet-600 uppercase tracking-widest">
                Question {currentCompIdx + 1} sur 3
              </div>
              <h5 className="text-xl font-black text-slate-800 mb-8">{state.comprehensionQuestions[currentCompIdx]?.text}</h5>

              {!state.userResponses[currentCompIdx] ? (
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase">1. Quel est le type de question ?</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(['littérale', 'inférentielle', 'évaluative'] as QuestionType[]).map(t => (
                        <button key={t} onClick={() => setCurrentCompType(t)} className={`p-3 rounded-xl border-2 font-black transition-all ${currentCompType === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-400 border-slate-100'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase">2. Ta réponse rédigée</label>
                    <textarea 
                      className="w-full p-5 bg-white border-2 border-slate-100 rounded-xl min-h-[120px] font-bold text-slate-800"
                      placeholder="N'oublie pas la majuscule et le point..."
                      value={currentCompAnswer}
                      onChange={(e) => setCurrentCompAnswer(e.target.value)}
                    />
                  </div>
                  <button onClick={submitComprehensionResponse} disabled={isSubmittingFeedback} className="w-full bg-violet-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2">
                    {isSubmittingFeedback ? <RefreshCw className="animate-spin" /> : "Faire corriger"}
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-in zoom-in-95">
                   <div className={`p-6 rounded-2xl border-l-8 ${state.userResponses[currentCompIdx].feedback?.isValid ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                      <p className="font-bold text-slate-800 mb-4">{state.userResponses[currentCompIdx].feedback?.explanation}</p>
                      <p className="text-sm italic text-slate-700 bg-white/60 p-4 rounded-xl shadow-sm border border-white/50">
                         💡 {state.userResponses[currentCompIdx].feedback?.advice}
                      </p>
                   </div>
                   <button onClick={nextQuestion} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl transition-all hover:bg-black">
                    {currentCompIdx < state.comprehensionQuestions.length - 1 ? "Question Suivante" : "Accéder à mon Bilan"}
                   </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* STEP: BILAN */}
      {state.step === 'bilan' && synthesis && (
        <div className="space-y-10 py-2">
          <div className="bg-gradient-to-br from-violet-600 to-indigo-800 p-8 rounded-[2.5rem] text-white text-center shadow-xl">
             <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400 animate-bounce" />
             <h2 className="text-3xl font-black mb-2">Séance Terminée !</h2>
             <div className="inline-block bg-white/20 px-8 py-3 rounded-full font-black text-2xl">
               Note Finale : {calculateScoreValue()} / 10
             </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border-2 border-slate-100 text-left shadow-sm">
             <h4 className="font-black text-violet-700 text-xl mb-4 flex items-center gap-2">
                <BookOpen className="w-6 h-6" /> {synthesis.title}
             </h4>
             <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-6">
                <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{synthesis.content}</p>
             </div>
             <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
                <ArrowUpCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                <p className="text-red-800 font-black text-sm">{synthesis.suggestion}</p>
             </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-8">
            <button onClick={exportPDF} className="flex-1 bg-red-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg hover:bg-red-700 transition-all">
              <Download className="w-5 h-5" /> Mon Bilan PDF
            </button>
            <button onClick={handleResetSession} className="flex-1 bg-white border-2 border-slate-100 text-slate-600 font-black py-4 rounded-xl flex items-center justify-center gap-3 shadow-md hover:bg-slate-50 transition-all">
              <RefreshCw className="w-5 h-5" /> Nouvelle lecture
            </button>
            <button onClick={handleFullExit} className="flex-1 bg-slate-900 text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-black transition-all">
              <LogOut className="w-5 h-5" /> Terminer
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
