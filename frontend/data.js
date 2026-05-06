// premium: false = always free  |  premium: true = requires subscription
const toolsData = [

    // ===== FREE TOOLS (10) =====

    { id: 'essay-writer', premium: false, category: 'Writing & Composition', name: 'Essay Writer', icon: 'fa-solid fa-pen-nib', desc: 'Generate full essays on any topic with structure.',
      inputs: [
          { type: 'text', id: 'topic', label: 'Essay Topic' },
          { type: 'select', id: 'tone', label: 'Tone', options: ['Academic', 'Persuasive', 'Narrative', 'Descriptive'] },
          { type: 'number', id: 'words', label: 'Word Count (approx)' }
      ],
      promptTemplate: (v) => `Write a ${v.words || 500}-word ${v.tone} essay about: "${v.topic}". Use clear structure with introduction, body paragraphs, and conclusion.`
    },

    { id: 'math-solver', premium: false, category: 'Science & Math', name: 'Math Solver', icon: 'fa-solid fa-calculator', desc: 'Step-by-step solutions for any math problem.',
      inputs: [{ type: 'textarea', id: 'problem', label: 'Enter Math Problem' }],
      systemMessage: "You are an expert math teacher. Solve step-by-step with clear explanations. Define each symbol. Show the core idea first, then steps. Use $...$ for inline math and $$...$$ for display math. Always finish with:\nFINAL ANSWER: <answer>\nEND",
      promptTemplate: (v) => `Solve step-by-step and teach clearly:\n\n${v.problem}`
    },

    { id: 'translator', premium: false, category: 'Languages & Translation', name: 'Universal Translator', icon: 'fa-solid fa-language', desc: 'Translate accurately between 100+ languages.',
      inputs: [
          { type: 'select', id: 'language', label: 'Target Language', options: ['Hindi', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Arabic', 'Portuguese', 'Russian', 'Korean', 'Italian'] },
          { type: 'textarea', id: 'text', label: 'Text to Translate' }
      ],
      promptTemplate: (v) => `Translate the following text accurately into ${v.language}. Preserve meaning and tone:\n\n${v.text}`
    },

    { id: 'summarizer', premium: false, category: 'Reading & Comprehension', name: 'Text Summarizer', icon: 'fa-solid fa-compress', desc: 'Condense long articles into crisp summaries.',
      inputs: [{ type: 'textarea', id: 'text', label: 'Paste Text to Summarize' }],
      promptTemplate: (v) => `Provide a concise, well-structured summary of the following text. Include key points as bullet points:\n\n${v.text}`
    },

    { id: 'eli5', premium: false, category: 'Reading & Comprehension', name: "Explain Like I'm 5", icon: 'fa-solid fa-child', desc: 'Simplify any complex topic for easy understanding.',
      inputs: [{ type: 'textarea', id: 'topic', label: 'Complex Topic or Concept' }],
      promptTemplate: (v) => `Explain this concept as simply as possible, like you are talking to a curious 10-year-old. Use analogies and simple examples:\n\n${v.topic}`
    },

    { id: 'flashcard-gen', premium: false, category: 'Productivity & Planning', name: 'Flashcard Maker', icon: 'fa-solid fa-clone', desc: 'Auto-generate Q&A flashcards for any topic.',
      inputs: [
          { type: 'text', id: 'topic', label: 'Topic' },
          { type: 'number', id: 'count', label: 'Number of Cards' }
      ],
      promptTemplate: (v) => `Create ${v.count || 10} Q&A flashcards for: "${v.topic}". Format each as:\nQ: [question]\nA: [answer]\n\nMake questions test understanding, not just recall.`
    },

    { id: 'vocab-builder', premium: false, category: 'Languages & Translation', name: 'Vocab Builder', icon: 'fa-solid fa-book-open', desc: 'Learn new words with definitions and examples.',
      inputs: [
          { type: 'text', id: 'topic', label: 'Topic or Subject Area' },
          { type: 'number', id: 'count', label: 'Number of Words' }
      ],
      promptTemplate: (v) => `Give me ${v.count || 8} important vocabulary words related to "${v.topic}". For each word provide: definition, example sentence, and memory tip.`
    },

    { id: 'motivation-coach', premium: false, category: 'Lifestyle & Fun', name: 'Motivation Coach', icon: 'fa-solid fa-fire-flame-curved', desc: 'Get pumped up with personalized motivation.',
      inputs: [{ type: 'textarea', id: 'situation', label: "What's holding you back?" }],
      promptTemplate: (v) => `Give me a powerful, personalized motivational message to overcome this challenge: "${v.situation}". Include actionable advice and an inspiring quote.`
    },

    { id: 'todo-ai', premium: false, category: 'Productivity & Planning', name: 'Task Breakdown AI', icon: 'fa-solid fa-list-check', desc: 'Break any big goal into actionable steps.',
      inputs: [{ type: 'textarea', id: 'goal', label: 'Your Goal or Project' }],
      promptTemplate: (v) => `Break down this goal into a clear, prioritized action plan with specific tasks, estimated time for each, and tips:\n\n"${v.goal}"`
    },

    { id: 'history-tutor', premium: false, category: 'History & Humanities', name: 'History Tutor', icon: 'fa-solid fa-monument', desc: 'Learn about any historical event, era, or figure.',
      inputs: [{ type: 'textarea', id: 'topic', label: 'Historical Topic or Event' }],
      promptTemplate: (v) => `Provide an engaging, detailed explanation of: "${v.topic}". Include timeline, key figures, causes, consequences, and lasting significance.`
    },

    // ===== PREMIUM TOOLS =====

    { id: 'worksheet-generator', premium: true, category: 'Productivity & Planning', name: 'Worksheet Generator', icon: 'fa-solid fa-file-lines', desc: 'Generate class-appropriate practice worksheets.',
      inputs: [
          { type: 'text', id: 'subject', label: 'Subject / Topic' },
          { type: 'select', id: 'grade', label: 'Class / Grade Level',
            options: ['Class 1','Class 2','Class 3','Class 4','Class 5',
                      'Class 6','Class 7','Class 8','Class 9','Class 10',
                      'Class 11','Class 12','College / University'] }
      ],
      systemMessage: "You are a certified curriculum expert specializing in Indian school education (CBSE/ICSE/State Boards) and college syllabi. You have deep knowledge of what topics are taught at each grade level. IMPORTANT: Before generating any worksheet, you MUST first validate whether the requested topic is genuinely taught at the specified grade level. Use your curriculum knowledge to check appropriateness. If the topic is NOT appropriate for that class (e.g., photosynthesis for Class 1, or basic addition for Class 12), DO NOT generate the worksheet. Instead, politely explain why it's mismatched and specify which class(es) the topic is actually appropriate for. Only proceed if the topic-grade combination is educationally valid.",
      promptTemplate: (v) => `VALIDATION REQUEST:\nTopic: "${v.subject}"\nGrade Level: ${v.grade}\n\nStep 1 — Curriculum Check: Is "${v.subject}" a topic genuinely covered in ${v.grade} according to standard Indian curriculum? If NO, explain the mismatch and stop.\n\nStep 2 — IF appropriate, generate a complete practice worksheet:\n• 5 Multiple Choice Questions (with 4 options each)\n• 3 Short Answer Questions (2-3 marks)\n• 2 Long Answer / Application Questions (5 marks)\n• Complete Answer Key at the end\n\nEnsure difficulty matches ${v.grade} standards precisely.`
    },

    { id: 'ai-tutor', premium: true, category: 'Science & Math', name: 'AI Tutor', icon: 'fa-solid fa-graduation-cap', desc: 'Interactive AI tutor tailored to your class level.',
      inputs: [
          { type: 'text', id: 'topic', label: 'What do you want to learn?' },
          { type: 'select', id: 'grade', label: 'Your Class / Level',
            options: ['Class 1-5','Class 6-8','Class 9-10','Class 11-12','College','Advanced'] },
          { type: 'select', id: 'style', label: 'Teaching Style', options: ['Socratic (Ask questions)', 'Direct Explanation', 'Analogy-based', 'Visual & Diagram-based'] }
      ],
      systemMessage: "You are an expert AI tutor who adapts explanations perfectly to the student's class level. Always check if the topic is age-appropriate for their level. If it seems too advanced or too simple, say so kindly and adjust your explanation accordingly.",
      promptTemplate: (v) => `I am a ${v.grade} student. Please teach me about "${v.topic}" using a ${v.style} approach. Adapt your language and depth to be perfect for my level. Validate if this topic is appropriate for ${v.grade} and proceed accordingly.`
    },

    { id: 'paragraph-gen', premium: true, category: 'Writing & Composition', name: 'Paragraph Generator', icon: 'fa-solid fa-align-left', desc: 'Create coherent, engaging paragraphs instantly.',
      inputs: [{ type: 'textarea', id: 'topic', label: 'What is this paragraph about?' }],
      promptTemplate: (v) => `Write a detailed, well-structured paragraph about: ${v.topic}. Make it engaging with a topic sentence, supporting details, and a conclusion.`
    },

    { id: 'cover-letter', premium: true, category: 'Career & Professional', name: 'Cover Letter Gen', icon: 'fa-solid fa-envelope-open-text', desc: 'Write tailored cover letters for any job.',
      inputs: [
          { type: 'text', id: 'role', label: 'Job Role/Position' },
          { type: 'textarea', id: 'jd', label: 'Job Description (paste here)' },
          { type: 'textarea', id: 'skills', label: 'Your Key Skills & Experience' }
      ],
      promptTemplate: (v) => `Write a compelling, personalized cover letter for the role of "${v.role}".\n\nJob Description:\n${v.jd}\n\nMy Skills & Experience:\n${v.skills}\n\nMake it professional, specific, and enthusiastic.`
    },

    { id: 'resume-builder', premium: true, category: 'Career & Professional', name: 'Resume Crafter', icon: 'fa-solid fa-file-contract', desc: 'Craft impactful resume bullet points.',
      inputs: [
          { type: 'text', id: 'role', label: 'Job Title/Role' },
          { type: 'textarea', id: 'experience', label: 'Describe your experience' }
      ],
      promptTemplate: (v) => `Write 6 powerful, action-oriented resume bullet points for the role of "${v.role}" based on: ${v.experience}. Use strong action verbs and quantify impact where possible.`
    },

    { id: 'interview-prep', premium: true, category: 'Career & Professional', name: 'Interview Coach', icon: 'fa-solid fa-user-tie', desc: 'Mock interview questions with ideal answers.',
      inputs: [
          { type: 'text', id: 'role', label: 'Job Role' },
          { type: 'select', id: 'type', label: 'Interview Type', options: ['Technical', 'Behavioral', 'HR/General', 'Case Study'] }
      ],
      promptTemplate: (v) => `Provide 7 ${v.type} interview questions for the role of "${v.role}" with detailed ideal answers. Include follow-up probing questions.`
    },

    { id: 'email-writer', premium: true, category: 'Career & Professional', name: 'Pro Email Writer', icon: 'fa-solid fa-envelope', desc: 'Write polished professional emails.',
      inputs: [
          { type: 'text', id: 'purpose', label: 'Email Purpose (e.g., job application)' },
          { type: 'select', id: 'tone', label: 'Tone', options: ['Formal', 'Friendly-Professional', 'Assertive', 'Apologetic'] },
          { type: 'textarea', id: 'context', label: 'Key Points to Include' }
      ],
      promptTemplate: (v) => `Write a professional ${v.tone} email for: "${v.purpose}".\n\nKey points: ${v.context}\n\nInclude subject line, proper greeting, clear body, and professional sign-off.`
    },

    { id: 'linkedin-bio', premium: true, category: 'Career & Professional', name: 'LinkedIn Bio Gen', icon: 'fa-brands fa-linkedin', desc: 'Craft a standout LinkedIn profile summary.',
      inputs: [
          { type: 'text', id: 'role', label: 'Your Role / Profession' },
          { type: 'textarea', id: 'highlights', label: 'Key achievements & skills' }
      ],
      promptTemplate: (v) => `Write a compelling LinkedIn summary for a ${v.role}. Highlights: ${v.highlights}. Make it engaging, keyword-rich, and written in first person.`
    },

    { id: 'grammar-tutor', premium: true, category: 'Languages & Translation', name: 'Grammar Tutor', icon: 'fa-solid fa-comment-dots', desc: 'Master grammar rules with explanations.',
      inputs: [
          { type: 'text', id: 'language', label: 'Language (e.g., English, French)' },
          { type: 'textarea', id: 'concept', label: 'Grammar concept or sentence to check' }
      ],
      promptTemplate: (v) => `Explain the grammar rules for this ${v.language} concept and correct any errors: "${v.concept}". Give clear rules, examples, and common mistakes to avoid.`
    },

    { id: 'pronunciation', premium: true, category: 'Languages & Translation', name: 'Pronunciation Guide', icon: 'fa-solid fa-volume-up', desc: 'Get phonetic spellings and speaking tips.',
      inputs: [{ type: 'textarea', id: 'text', label: 'Words or phrases to pronounce' }],
      promptTemplate: (v) => `Provide a detailed pronunciation guide for: "${v.text}". Include phonetic spelling (IPA), stress patterns, common mistakes, and tips.`
    },

    { id: 'idiom-explainer', premium: true, category: 'Languages & Translation', name: 'Idiom Explainer', icon: 'fa-solid fa-masks-theater', desc: 'Decode idioms, proverbs, and slang.',
      inputs: [{ type: 'textarea', id: 'idiom', label: 'Idiom or phrase to explain' }],
      promptTemplate: (v) => `Explain the idiom/phrase: "${v.idiom}". Include: literal vs figurative meaning, origin/etymology, usage examples, and equivalent phrases in other cultures.`
    },

    { id: 'study-planner', premium: true, category: 'Productivity & Planning', name: 'Study Schedule', icon: 'fa-solid fa-calendar-days', desc: 'Generate personalized study schedules.',
      inputs: [
          { type: 'text', id: 'subjects', label: 'Subjects to Study' },
          { type: 'select', id: 'grade', label: 'Class / Level', options: ['Class 1-5','Class 6-8','Class 9-10','Class 11-12','College','Competitive Exam'] },
          { type: 'number', id: 'days', label: 'Days Until Exam' }
      ],
      systemMessage: "You are a study planner expert who creates realistic, grade-appropriate study schedules. Validate that the subjects listed match the student's grade level before creating the schedule.",
      promptTemplate: (v) => `Create a detailed ${v.days || 14}-day study schedule for a ${v.grade} student studying: ${v.subjects}. First validate these subjects are appropriate for ${v.grade}. Include daily time blocks, revision strategies, and mock test days.`
    },

    { id: 'pomodoro-guide', premium: true, category: 'Productivity & Planning', name: 'Focus Strategy', icon: 'fa-solid fa-stopwatch', desc: 'Get a personalized Pomodoro focus plan.',
      inputs: [{ type: 'textarea', id: 'task', label: 'What are you trying to accomplish?' }],
      promptTemplate: (v) => `Design a personalized Pomodoro focus strategy for: "${v.task}". Include session lengths, break activities, focus techniques, and how to handle distractions.`
    },

    { id: 'habit-tracker', premium: true, category: 'Productivity & Planning', name: 'Habit Designer', icon: 'fa-solid fa-leaf', desc: 'Build powerful study habits in 30 days.',
      inputs: [{ type: 'textarea', id: 'goal', label: 'Habit you want to build' }],
      promptTemplate: (v) => `Design a 30-day habit-building plan for: "${v.goal}". Include daily actions, milestones, accountability strategies, and how to recover after missing a day.`
    },

    { id: 'formula-sheet', premium: true, category: 'Science & Math', name: 'Formula Generator', icon: 'fa-solid fa-subscript', desc: 'Generate formula cheat sheets for any topic.',
      inputs: [
          { type: 'text', id: 'subject', label: 'Subject / Topic' },
          { type: 'select', id: 'grade', label: 'Class Level', options: ['Class 6-8','Class 9-10','Class 11-12','College','Advanced'] }
      ],
      systemMessage: "You are a curriculum expert. Validate that the requested formulas are appropriate for the specified class level before generating.",
      promptTemplate: (v) => `Generate a comprehensive formula sheet for "${v.subject}" at ${v.grade} level. First verify this matches the curriculum for that level. List all key formulas with: name, formula (using proper notation), variables explained, and a quick example.`
    },

    { id: 'stats-helper', premium: true, category: 'Science & Math', name: 'Statistics Assistant', icon: 'fa-solid fa-chart-pie', desc: 'Solve statistics and data analysis problems.',
      inputs: [{ type: 'textarea', id: 'problem', label: 'Statistics problem or data' }],
      promptTemplate: (v) => `Solve this statistics problem step-by-step:\n\n${v.problem}\n\nExplain each statistical concept used and interpret the results in plain English.`
    },

    { id: 'code-explainer', premium: true, category: 'Coding & Tech', name: 'Code Explainer', icon: 'fa-solid fa-code', desc: 'Understand any code snippet instantly.',
      inputs: [
          { type: 'select', id: 'lang', label: 'Language', options: ['JavaScript','Python','Java','C++','C','SQL','TypeScript','Other'] },
          { type: 'textarea', id: 'code', label: 'Paste Code Here' }
      ],
      promptTemplate: (v) => `Explain this ${v.lang} code in clear, simple terms:\n\n\`\`\`${v.lang.toLowerCase()}\n${v.code}\n\`\`\`\n\nExplain: what it does, how it works line-by-line, its purpose, and any potential improvements.`
    },

    { id: 'bug-fixer', premium: true, category: 'Coding & Tech', name: 'Bug Fixer', icon: 'fa-solid fa-bug', desc: 'Find and fix bugs in your code.',
      inputs: [
          { type: 'select', id: 'lang', label: 'Language', options: ['JavaScript','Python','Java','C++','C','SQL','TypeScript','Other'] },
          { type: 'textarea', id: 'code', label: 'Buggy Code' },
          { type: 'textarea', id: 'error', label: 'Error Message (if any)' }
      ],
      promptTemplate: (v) => `Debug this ${v.lang} code:\n\n\`\`\`${v.lang.toLowerCase()}\n${v.code}\n\`\`\`\n\nError: ${v.error || 'none specified'}\n\nIdentify all bugs, explain what caused them, and provide the corrected code with comments.`
    },

    { id: 'sql-gen', premium: true, category: 'Coding & Tech', name: 'SQL Generator', icon: 'fa-solid fa-database', desc: 'Generate SQL queries from plain English.',
      inputs: [
          { type: 'textarea', id: 'description', label: 'Describe what you need' },
          { type: 'textarea', id: 'schema', label: 'Table Schema (optional)' }
      ],
      promptTemplate: (v) => `Write optimized SQL to: "${v.description}".\n\nSchema: ${v.schema || 'infer from context'}\n\nProvide the query with explanation of each clause.`
    },

    { id: 'regex-builder', premium: true, category: 'Coding & Tech', name: 'Regex Builder', icon: 'fa-solid fa-code-branch', desc: 'Build and explain Regular Expressions.',
      inputs: [{ type: 'textarea', id: 'task', label: 'What should the regex match?' }],
      promptTemplate: (v) => `Create a Regular Expression to: "${v.task}". Provide: the regex pattern, explanation of each part, example matches/non-matches, and code example in JavaScript.`
    },

    { id: 'algorithm-tutor', premium: true, category: 'Coding & Tech', name: 'Algorithm Tutor', icon: 'fa-solid fa-project-diagram', desc: 'Master algorithms with visual explanations.',
      inputs: [{ type: 'text', id: 'algorithm', label: 'Algorithm name or problem' }],
      promptTemplate: (v) => `Explain the "${v.algorithm}" algorithm comprehensively: concept, step-by-step walkthrough with example, time/space complexity analysis, use cases, and Python/JavaScript implementation.`
    },

    { id: 'web-dev-helper', premium: true, category: 'Coding & Tech', name: 'Web Dev Helper', icon: 'fa-brands fa-html5', desc: 'Get HTML/CSS/JS snippets and guidance.',
      inputs: [{ type: 'textarea', id: 'task', label: 'What do you need to build?' }],
      promptTemplate: (v) => `Create clean, modern code for: "${v.task}". Provide HTML, CSS, and JavaScript as needed. Explain key decisions and any browser compatibility notes.`
    },

    { id: 'key-takeaways', premium: true, category: 'Reading & Comprehension', name: 'Key Takeaways', icon: 'fa-solid fa-key', desc: 'Extract the most important points from any text.',
      inputs: [{ type: 'textarea', id: 'text', label: 'Paste Text Here' }],
      promptTemplate: (v) => `Extract the top 7 key takeaways from this text. Format as a numbered list with bold headers and 1-2 sentence explanations:\n\n${v.text}`
    },

    { id: 'qna-generator', premium: true, category: 'Reading & Comprehension', name: 'Reading Q&A', icon: 'fa-solid fa-circle-question', desc: 'Generate comprehension questions from any text.',
      inputs: [
          { type: 'textarea', id: 'text', label: 'Text to Generate Questions From' },
          { type: 'number', id: 'count', label: 'Number of Questions' }
      ],
      promptTemplate: (v) => `Generate ${v.count || 8} reading comprehension questions (varying difficulty levels: easy, medium, hard) for this text, with model answers:\n\n${v.text}`
    },

    { id: 'pdf-summarizer', premium: true, category: 'Reading & Comprehension', name: 'PDF Summarizer', icon: 'fa-solid fa-file-pdf', desc: 'Summarize long PDF documents.',
      inputs: [
          { type: 'file', id: 'pdfFile', label: 'Upload PDF File', accept: '.pdf' },
          { type: 'textarea', id: 'pdfText', label: 'Or Paste PDF Text Here' }
      ],
      promptTemplate: (v) => `Summarize this document content in comprehensive bullet points organized by sections. Highlight key findings, data, and conclusions:\n\n${v.pdfFile || v.pdfText}`
    },

    { id: 'video-summarizer', premium: true, category: 'Reading & Comprehension', name: 'Video Summarizer', icon: 'fa-solid fa-video', desc: 'Summarize video transcripts.',
      inputs: [
          { type: 'file', id: 'transcriptFile', label: 'Upload Transcript (.txt/.srt)', accept: '.txt,.vtt,.srt' },
          { type: 'textarea', id: 'transcript', label: 'Or Paste Transcript' }
      ],
      promptTemplate: (v) => `Summarize this video transcript: key topics covered, main arguments, important timestamps (if available), and actionable takeaways:\n\n${v.transcriptFile || v.transcript}`
    },

    { id: 'image-summarizer', premium: true, category: 'Reading & Comprehension', name: 'Image Explainer', icon: 'fa-solid fa-image', desc: 'Explain diagrams, charts, and images.',
      inputs: [
          { type: 'file', id: 'imgFile', label: 'Upload Image', accept: 'image/*' },
          { type: 'textarea', id: 'imgText', label: 'Or describe what you see' }
      ],
      promptTemplate: (v) => `Explain the concepts in this image/diagram description in detail:\n\n${v.imgFile || v.imgText}`
    },

    { id: 'chapter-summarizer', premium: true, category: 'Reading & Comprehension', name: 'Chapter Summarizer', icon: 'fa-solid fa-book-open', desc: 'Summarize textbook chapters with ease.',
      inputs: [
          { type: 'text', id: 'chapterName', label: 'Chapter Name/Topic' },
          { type: 'textarea', id: 'content', label: 'Chapter Content' }
      ],
      promptTemplate: (v) => `Summarize this textbook chapter "${v.chapterName}" with: overview paragraph, key concepts list, important definitions, formulas/diagrams mentioned, and 5 most likely exam questions:\n\n${v.content}`
    },

    { id: 'philosophy-bot', premium: true, category: 'History & Humanities', name: 'Philosophy Bot', icon: 'fa-solid fa-brain', desc: 'Explore philosophical concepts and thinkers.',
      inputs: [{ type: 'textarea', id: 'topic', label: 'Philosophical question or concept' }],
      promptTemplate: (v) => `Explore the philosophy of: "${v.topic}". Cover key thinkers, main arguments, historical context, counterarguments, and relevance today.`
    },

    { id: 'geography-guide', premium: true, category: 'History & Humanities', name: 'Geography Guide', icon: 'fa-solid fa-earth-americas', desc: 'Explore countries, geography, and geopolitics.',
      inputs: [{ type: 'textarea', id: 'topic', label: 'Country, region, or geography topic' }],
      promptTemplate: (v) => `Provide comprehensive geographical information about: "${v.topic}". Include physical geography, demographics, economy, culture, geopolitical significance, and interesting facts.`
    },

    { id: 'art-history', premium: true, category: 'History & Humanities', name: 'Art History', icon: 'fa-solid fa-palette', desc: 'Analyze art movements and masterpieces.',
      inputs: [{ type: 'textarea', id: 'topic', label: 'Art movement, artist, or artwork' }],
      promptTemplate: (v) => `Analyze: "${v.topic}" in art history. Cover: historical context, style characteristics, key works, artist biography (if applicable), influence on later art, and cultural significance.`
    },

    { id: 'trivia-gen', premium: true, category: 'Lifestyle & Fun', name: 'Trivia Generator', icon: 'fa-solid fa-dice', desc: 'Generate fun trivia for study breaks.',
      inputs: [
          { type: 'text', id: 'topic', label: 'Topic (or "random")' },
          { type: 'number', id: 'count', label: 'Number of Questions' }
      ],
      promptTemplate: (v) => `Generate ${v.count || 10} interesting trivia questions about "${v.topic}" with answers. Include a mix of easy, medium, and hard questions. Add a fun fact for each.`
    },

    { id: 'joke-writer', premium: true, category: 'Lifestyle & Fun', name: 'Joke Writer', icon: 'fa-solid fa-face-laugh-squint', desc: 'Generate clever, educational jokes.',
      inputs: [{ type: 'text', id: 'topic', label: 'Topic for the joke' }],
      promptTemplate: (v) => `Write 5 clever, educational jokes about "${v.topic}" that a student would appreciate. Include a mix of puns and wordplay.`
    },

    { id: 'idea-gen', premium: true, category: 'Brainstorming', name: 'Idea Generator', icon: 'fa-solid fa-lightbulb', desc: 'Brainstorm creative ideas for any project.',
      inputs: [{ type: 'textarea', id: 'context', label: 'Project context or challenge' }],
      promptTemplate: (v) => `Generate 12 creative, diverse ideas for: "${v.context}". Rate each by feasibility and impact. Include one wild/unconventional idea.`
    },

    { id: 'name-gen', premium: true, category: 'Brainstorming', name: 'Name Generator', icon: 'fa-solid fa-tag', desc: 'Generate catchy names for projects or startups.',
      inputs: [
          { type: 'textarea', id: 'context', label: 'What is your project about?' },
          { type: 'select', id: 'style', label: 'Name Style', options: ['Professional', 'Catchy/Fun', 'Technical', 'Abstract', 'Descriptive'] }
      ],
      promptTemplate: (v) => `Generate 15 ${v.style} names for: "${v.context}". For each: name, why it works, domain availability likelihood. Mark your top 3 recommendations.`
    },

    { id: 'mindmap-gen', premium: true, category: 'Brainstorming', name: 'Mindmap Creator', icon: 'fa-solid fa-sitemap', desc: 'Create structured mindmaps for any topic.',
      inputs: [{ type: 'text', id: 'topic', label: 'Central Topic' }],
      promptTemplate: (v) => `Create a comprehensive text-based mindmap for "${v.topic}". Use indented structure with emojis. Include 5-7 main branches, each with 3-5 sub-topics and key details.`
    },

    { id: 'pros-cons', premium: true, category: 'Brainstorming', name: 'Pros & Cons Analyzer', icon: 'fa-solid fa-scale-balanced', desc: 'Analyze any decision with detailed pros/cons.',
      inputs: [{ type: 'textarea', id: 'decision', label: 'Decision or option to analyze' }],
      promptTemplate: (v) => `Analyze: "${v.decision}". Provide: 6 pros with explanations, 6 cons with explanations, short-term vs long-term perspective, who it benefits most, and a balanced recommendation.`
    }
];
