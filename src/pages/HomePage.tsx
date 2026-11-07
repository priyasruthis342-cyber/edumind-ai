import { useState, useMemo } from 'react';
import { Search, ArrowRight, Sparkles, BookOpen, GraduationCap, Stethoscope, Briefcase, Award, Compass, X } from 'lucide-react';
import { useApp } from '@/context/useApp';
import { BookIllustration } from '@/components/BookIllustration';
import { PaymentDialog } from '@/components/PaywallGate';
import { isPaymentPassActive } from '@/lib/payment';

interface CourseCategory {
  id: string;
  titleKey: string;
  descKey: string;
  icon: React.ComponentType<{ className?: string }>;
  departments: string[];
}

// பல்வேறு மொழிகளுக்கான முழுமையான மொழிபெயர்ப்புகள் (Multi-language Support)
const translations: Record<string, Record<string, string>> = {
  en: {
    heroTitle: "Turn any page into a study quest",
    heroDesc: "Scan a textbook page, get your chapter, important concepts, AI notes, practice test and audio lessons in your language.",
    scanPage: "Scan a page",
    chooseCourse: "Choose Your Course & Department",
    chooseDesc: "Select your stream or search specific departments (Engineering, Medical, TNPSC, etc.)",
    searchPlaceholder: "Search department (e.g. CSE, MBBS, Group 4, Civil)...",
    startStudying: "Explore Departments",
    noCourses: "No departments found matching",
    deptFound: "Departments Available",
    selectDeptModalTitle: "Select Department",
    modalSubtitle: "Search and choose your department to proceed",
    searchDeptPlaceholder: "Search department...",
    selectDeptAction: "Select Department"
  },
  ta: {
    heroTitle: "எந்தப் பக்கத்தையும் ஒரு கல்விப் பயணமாக மாற்றுங்கள்",
    heroDesc: "பாடப்புத்தகப் பக்கத்தை ஸ்கேன் செய்யுங்கள், உங்கள் பாடம், முக்கியக் குறிப்புகள், AI குறிப்புகள் மற்றும் ஆடியோ பாடங்களைப் பெறுங்கள்.",
    scanPage: "பக்கத்தை ஸ்கேன் செய்",
    chooseCourse: "உங்கள் கோர்ஸ் & துறையைத் தேர்ந்தெடுக்கவும்",
    chooseDesc: "உங்கள் பாடப்பிரிவு அல்லது துறையைத் தேடித் தேர்ந்தெடுக்கவும் (Engineering, Medical, TNPSC போன்றவை)",
    searchPlaceholder: "துறையைத் தேடவும் (எ.கா: CSE, MBBS, Group 4)...",
    startStudying: "துறைகளைக் காண்",
    noCourses: "பொருத்தமான துறைகள் எதுவும் கிடைக்கவில்லை",
    deptFound: "கிடைக்கும் பாடப்பிரிவுகள்",
    selectDeptModalTitle: "துறையைத் தேர்ந்தெடுக்கவும்",
    modalSubtitle: "தொடர உங்கள் துறையைத் தேடித் தேர்ந்தெடுக்கவும்",
    searchDeptPlaceholder: "துறையைத் தேடவும்...",
    selectDeptAction: "இந்தத் துறையைத் தேர்ந்தெடு"
  },
  ml: {
    heroTitle: "ഏത് പേജും ഒരു പഠന യാത്രയാക്കി മാറ്റൂ",
    heroDesc: "പാഠപുസ്തക പേജ് സ്കാൻ ചെയ്യുക, അധ്യായങ്ങൾ, എഐ കുറിപ്പുകൾ, ഓഡിയോ പാഠങ്ങൾ എന്നിവ നേടുക.",
    scanPage: "പേജ് സ്കാൻ ചെയ്യുക",
    chooseCourse: "നിങ്ങളുടെ കോഴ്സും ഡിപ്പാർട്ട്മെന്റും തിരഞ്ഞെടുക്കുക",
    chooseDesc: "പഠനം ആരംഭിക്കാൻ ഡിപ്പാർട്ട്മെന്റ് തിരയുക",
    searchPlaceholder: "തിരയുക (ഉദാ: CSE, MBBS, TNPSC)...",
    startStudying: "തുടങ്ങുക",
    noCourses: "ഡിപ്പാർട്ട്മെന്റുകൾ ഒന്നും കണ്ടെത്തിയില്ല",
    deptFound: "ലഭ്യമായ വിഭാഗങ്ങൾ",
    selectDeptModalTitle: "ഡിപ്പാർട്ട്മെന്റ് തിരഞ്ഞെടുക്കുക",
    modalSubtitle: "തുടരാൻ നിങ്ങളുടെ ഡിപ്പാർട്ട്മെന്റ് തിരഞ്ഞെടുക്കുക",
    searchDeptPlaceholder: "ഡിപ്പാർട്ട്മെന്റ് തിരയുക...",
    selectDeptAction: "തിരഞ്ഞെടുക്കുക"
  },
  hi: {
    heroTitle: "किसी भी पृष्ठ को अध्ययन यात्रा में बदलें",
    heroDesc: "पाठ्यपुस्तक का पृष्ठ स्कैन करें, अध्याय, एआई नोट्स और ऑडियो पाठ प्राप्त करें।",
    scanPage: "स्कैन करें",
    chooseCourse: "अपना पाठ्यक्रम और विभाग चुनें",
    chooseDesc: "अपनी विषय शाखा या विभाग खोजें",
    searchPlaceholder: "खोजें (जैसे: CSE, MBBS, Group 4)...",
    startStudying: "अध्ययन शुरू करें",
    noCourses: "कोई विभाग नहीं मिला",
    deptFound: "उपलब्ध विभाग",
    selectDeptModalTitle: "विभाग चुनें",
    modalSubtitle: "आगे بڑھنے کے लिए अपना विभाग चुनें",
    searchDeptPlaceholder: "विभाग खोजें...",
    selectDeptAction: "चुनें"
  },
  te: {
    heroTitle: "ఏ పేజీనైనా అభ్యసన యాత్రగా మార్చండి",
    heroDesc: "టెక్స్ట్ బుక్ పేజీని స్కాన్ చేయండి, చాప్టర్స్, AI నోట్స్ మరియు ఆడియో పాఠాలను పొందండి.",
    scanPage: "పేజీని స్కాన్ చేయي",
    chooseCourse: "మీ కోర్సు మరియు విభాగాన్ని ఎంచుకోండి",
    chooseDesc: "మీ సబ్జెక్ట్ లేదా విభాగాన్ని వెతకండి",
    searchPlaceholder: "వెతకండి (ఉదా: CSE, MBBS, Group 4)...",
    startStudying: "ప్రారంభించండి",
    noCourses: "విభాగాలు కనుగొనబడలేదు",
    deptFound: "అందుబాటులో ఉన్న విభాగాలు",
    selectDeptModalTitle: "విభాగాన్ని ఎంచుకోండి",
    modalSubtitle: "ముందుకు వెళ్లడానికి మీ విభాగాన్ని ఎంచుకోండి",
    searchDeptPlaceholder: "విభాగాన్ని వెతకండి...",
    selectDeptAction: "ఎంచుకోండి"
  },
  kn: {
    heroTitle: "ಯಾವುದೇ ಪುಟವನ್ನು ಅಧ್ಯಯನ ಯಾತ್ರೆಯಾಗಿ ಬದಲಾಯಿಸಿ",
    heroDesc: "ಪಠ್ಯಪುಸ್ತಕದ ಪುಟವನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ, ಅಧ್ಯಾಯಗಳು, AI ಟಿಪ್ಪಣಿಗಳನ್ನು ಪಡೆಯಿರಿ.",
    scanPage: "ಪುಟವನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ",
    chooseCourse: "ನಿಮ್ಮ ಕೋರ್ಸ್ ಮತ್ತು ವಿಭಾಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    chooseDesc: "ನಿಮ್ಮ ವಿಷಯ ಅಥವಾ ವಿಭಾಗವನ್ನು ಹುಡುಕಿ",
    searchPlaceholder: "ಹುಡುಕಿ (ಉದಾ: CSE, MBBS, Group 4)...",
    startStudying: "ಪ್ರಾರಂಭಿಸಿ",
    noCourses: "ಯಾವುದೇ ವಿಭಾಗಗಳು ಕಂಡುಬಂದಿಲ್ಲ",
    deptFound: "ಲಭ್ಯವಿರುವ ವಿಭಾಗಗಳು",
    selectDeptModalTitle: "ವಿಭಾಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    modalSubtitle: "ಮುಂದುವರಿಯಲು ನಿಮ್ಮ ವಿಭಾಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    searchDeptPlaceholder: "ವಿಭಾಗವನ್ನು ಹುಡುಕಿ...",
    selectDeptAction: "ಆಯ್ಕೆಮಾಡಿ"
  }
};

// நீங்கள் கேட்ட அனைத்து முக்கிய கோர்ஸ்களும் மற்றும் அனைத்து துறைகளும் (Arts & Science உள்பட)
const COURSE_CATEGORIES: CourseCategory[] = [
  {
    id: 'school-6-10',
    titleKey: '6th to 10th Standard',
    descKey: 'All subjects (Maths, Science, Social, Tamil, English) for classes 6 to 10.',
    icon: BookOpen,
    departments: ['Class 6th Tamil Medium', 'Class 6th English Medium', 'Class 7th Tamil Medium', 'Class 7th English Medium', 'Class 8th Standard', 'Class 9th Standard', 'Class 10th Board Exam Special']
  },
  {
    id: 'school-11-12',
    titleKey: '11th to 12th Standard',
    descKey: 'Bio-Maths, Computer Science, Commerce, Arts and Bio-Chemistry streams.',
    icon: GraduationCap,
    departments: ['11th Bio-Maths', '11th Computer Science', '11th Commerce', '11th Arts Group', '12th Bio-Maths Board', '12th Computer Science Board', '12th Commerce Board', '12th Pure Science']
  },
  {
    id: 'engineering',
    titleKey: 'Engineering',
    descKey: 'Core & modern engineering streams with AI theory and notes.',
    icon: Compass,
    departments: [

      'Computer Science and Engineering (CSE)',

      'Information Technology (IT)',

      'Computer Science and Business Systems (CSBS)',

      'Artificial Intelligence and Machine Learning (AI & ML)',

      'Artificial Intelligence and Data Science (AI & DS)',

      'Data Science (DS)',

      'Cyber Security',
      'Internet of Things (IoT)',

      'Software Engineering',

      'Cloud Computing',

      'Blockchain Technology',

      'Computer Engineering',

      'Computer Science and Design',

      'Computer Science and Technology',

      'Mechanical Engineering',

      'Automobile Engineering',

      'Mechatronics Engineering',

      'Robotics and Automation',

      'Manufacturing Engineering',

      'Industrial Engineering',

      'Production Engineering',

      'Aerospace Engineering',

      'Aeronautical Engineering',

      'Marine Engineering',

      'Mining Engineering',

      'Metallurgical Engineering',

      'Materials Science and Engineering',

      'Agricultural Engineering',

      'Additive Manufacturing',

      'Electrical and Electronics Engineering (EEE)',

      'Electronics and Communication Engineering (ECE)',

      'Electronics and Instrumentation Engineering (EIE)',

      'Electronics Engineering',

      'Electrical Engineering',

      'Instrumentation and Control Engineering',

      'Biomedical Engineering',

      'VLSI Design and Technology',

      'Embedded Systems',

      'Power Electronics and Drives',

      'Renewable Energy Engineering',

      'Control Systems Engineering',

      'Communication Systems Engineering',

      'Civil Engineering',

      'Structural Engineering',

      'Geotechnical Engineering',

      'Environmental Engineering',

      'Transportation Engineering',

      'Construction Engineering and Management',

      'Water Resources Engineering',

      'Coastal Engineering',

      'Urban Planning',

      'Surveying and Geomatics Engineering',

      'Infrastructure Engineering',

      'Smart City Engineering',

      'Chemical Engineering',

      'Petroleum Engineering',

      'Petrochemical Engineering',

      'Polymer Engineering',

      'Plastic Technology',

      'Textile Technology',

      'Food Technology',

      'Biotechnology',

      'Biochemical Engineering',

      'Pharmaceutical Engineering',

      'Aircraft Maintenance Engineering',

      'Avionics Engineering',

      'Space Technology',

      'Astronautical Engineering',

      'Quantum Computing',
      'Nanotechnology Engineering',

      'Electric Vehicle Technology',

      'Autonomous Systems Engineering',

      'Artificial Intelligence Engineering',

      'Smart Manufacturing',

      'Sustainable Engineering',

      'Semiconductor Engineering',

      'Fisheries Engineering',

      'Dairy Technology',

      'Printing Technology',

      'Leather Technology',

      'Ceramic Technology',

      'Safety and Fire Engineering',

      'Packaging Technology'



    ]
  },
  {
    id: 'arts-science',
    titleKey: 'Arts & Science',
    descKey: 'All Arts, Science and Commerce degree departments.',
    icon: GraduationCap,
    departments: [
      'B.A. Tamil',
      'B.A. English',
      'B.A. Hindi',
      'B.A. Sanskrit',
      'B.A. Malayalam',
      'B.A. Telugu',
      'B.A. Kannada',
      'B.A. French',
      'B.A. History',
      'B.A. Economics',
      'B.A. Political Science',
      'B.A. Public Administration',
      'B.A. Sociology',
      'B.A. Psychology',
      'B.A. Social Work',
      'B.A. Journalism and Mass Communication',
      'B.A. Visual Communication',
      'B.A. Philosophy',
      'B.A. Geography',
      'B.Sc. Mathematics',
      'B.Sc. Statistics',
      'B.Sc. Physics',
      'B.Sc. Chemistry',
      'B.Sc. Botany',
      'B.Sc. Zoology',
      'B.Sc. Computer Science',
      'B.Sc. Information Technology',
      'B.Sc. Computer Technology',
      'B.Sc. Computer Applications',
      'B.Sc. Artificial Intelligence',
      'B.Sc. Data Science',
      'B.Sc. Cyber Security',
      'B.Sc. Biotechnology',
      'B.Sc. Microbiology',
      'B.Sc. Biochemistry',
      'B.Sc. Bioinformatics',
      'B.Sc. Genetics',
      'B.Sc. Environmental Science',
      'B.Sc. Electronics',
      'B.Sc. Animation',
      'B.Sc. Fashion Design',
      'B.Sc. Interior Design',
      'B.Sc. Fashion Technology',
      'B.Sc. Textile Design',
      'B.Sc. Food Science and Nutrition',
      'B.Sc. Nutrition and Dietetics',
      'B.Sc. Home Science',
      'B.Sc. Physical Education',
      'B.Sc. Sports Science',
      'B.Sc. Forensic Science',
      'B.Sc. Actuarial Science',
      'B.Sc. Applied Mathematics',
      'B.Sc. Applied Physics',
      'B.Sc. Applied Chemistry',
      'B.Sc. Industrial Chemistry',
      'B.Sc. Marine Biology',
      'B.Sc. Aquaculture',
      'B.Sc. Plant Biology',
      'B.Sc. Animal Science',
      'B.Sc. Food Technology',
      'B.Com. General',
      'B.Com. Computer Applications',
      'B.Com. Accounting and Finance',
      'B.Com. Corporate Secretaryship',
      'B.Com. Banking and Insurance',
      'B.Com. International Business',
      'B.Com. Business Economics',
      'B.Com. Finance',
      'B.Com. Marketing',
      'B.Com. E-Commerce',
      'BBA (Business Administration)',
      'BBA Finance',
      'BBA Marketing',
      'BBA Human Resource Management',
      'BBA Logistics and Supply Chain Management',
      'BBA International Business',
      'BCA (Computer Applications)',
      'BCA Data Science',
      'BCA Artificial Intelligence',
      'BCA Cyber Security',
      'Bachelor of Hotel Management',
      'Tourism and Travel Management',
      'Hospitality Management',
      'Library and Information Science',
      'Criminology',
      'Fine Arts',
      'Performing Arts',
      'Music',
      'Dance',
      'Theatre Arts',
      'Photography',
      'Film Studies',
      'Graphic Design',
      'Printing Technology'

    ]
  },
  {
    id: 'medical',
    titleKey: 'Medical',
    descKey: 'Medical degree courses, study modules and clinical basics.',
    icon: Stethoscope,
    departments: [
      'ANM (Auxiliary Nursing and Midwifery)',
      'GNM (General Nursing and Midwifery)',
      'B.Sc. Nursing',
      'Post Basic B.Sc. Nursing',
      'M.Sc. Nursing',
      'Ph.D. in Nursing',
      'Nurse Practitioner in Critical Care',
      'Pediatric Nursing',
      'Medical Surgical Nursing',
      'Obstetrics and Gynecological Nursing',
      'Community Health Nursing',
      'Psychiatric Nursing',
      'Mental Health Nursing',
      'Child Health Nursing',
      'Critical Care Nursing',
      'Emergency and Trauma Nursing',
      'Cardiac Nursing',
      'Oncology Nursing',
      'Neonatal Nursing',
      'Nephrology Nursing',
      'Orthopedic Nursing',
      'Geriatric Nursing',
      'Palliative Care Nursing',
      'Perioperative Nursing',
      'Operation Theatre Nursing',
      'Intensive Care Unit Nursing',
      'Midwifery Nursing',
      'Public Health Nursing',
      'Family Health Nursing',
      'Infection Control Nursing',
      'Nursing Education',
      'Nursing Administration',
      'Nursing Research'

    ]
  },
  {
    id: 'nursing',
    titleKey: 'Nursing',
    descKey: 'Nursing fundamentals, anatomy, physiology & care modules.',
    icon: Stethoscope,
    departments: [
      'ANM (Auxiliary Nursing and Midwifery)',
      'GNM (General Nursing and Midwifery)',
      'B.Sc. Nursing',
      'Post Basic B.Sc. Nursing',
      'M.Sc. Nursing',
      'Ph.D. in Nursing',
      'Nurse Practitioner in Critical Care',
      'Pediatric Nursing',
      'Medical Surgical Nursing',
      'Obstetrics and Gynecological Nursing',
      'Community Health Nursing',
      'Psychiatric Nursing',
      'Mental Health Nursing',
      'Child Health Nursing',
      'Critical Care Nursing',
      'Emergency and Trauma Nursing',
      'Cardiac Nursing',
      'Oncology Nursing',
      'Neonatal Nursing',
      'Nephrology Nursing',
      'Orthopedic Nursing',
      'Geriatric Nursing',
      'Palliative Care Nursing',
      'Perioperative Nursing',
      'Operation Theatre Nursing',
      'Intensive Care Unit Nursing',
      'Midwifery Nursing',
      'Public Health Nursing',
      'Family Health Nursing',
      'Infection Control Nursing',
      'Nursing Education',
      'Nursing Administration',
      'Nursing Research'

    ]
  },
  {
    id: 'neet',
    titleKey: 'NEET Exam Prep',
    descKey: 'Comprehensive Medical entrance exams prep (Biology, Physics, Chemistry).',
    icon: Award,
    departments: [
      'NEET UG Preparation',
      'NEET Physics',
      'NEET Chemistry',
      'NEET Biology',
      'NEET Botany',
      'NEET Zoology',
      'NEET Biology Practical Concepts',
      'NEET Previous Year Questions',
      'NEET Mock Tests',
      'NEET Important Questions',
      'NEET Chapter Wise Tests',
      'NEET Revision Notes',
      'NEET Study Plan',
      'NEET Practice Tests',
      'NEET Question Bank',
      'NEET Exam Preparation'
    ]
  },
  {
    id: 'jee',
    titleKey: 'JEE Exam Prep',
    descKey: 'Engineering entrance prep for JEE Main & Advanced.',
    icon: Award,
    departments: [
      'JEE Main Preparation',
      'JEE Advanced Preparation',
      'JEE Physics',
      'JEE Chemistry',
      'JEE Mathematics',
      'JEE Algebra',
      'JEE Calculus',
      'JEE Trigonometry',
      'JEE Coordinate Geometry',
      'JEE Vector Algebra',
      'JEE 3D Geometry',
      'JEE Mechanics',
      'JEE Thermodynamics',
      'JEE Optics',
      'JEE Modern Physics',
      'JEE Organic Chemistry',
      'JEE Inorganic Chemistry',
      'JEE Physical Chemistry',
      'JEE Previous Year Questions',
      'JEE Mock Tests',
      'JEE Important Questions',
      'JEE Chapter Wise Tests',
      'JEE Revision Notes',
      'JEE Study Plan',
      'JEE Practice Tests',
      'JEE Question Bank',
      'JEE Full Length Tests'
    ]
  },
  {
    id: 'tnpsc',
      titleKey: 'TNPSC',
        descKey: 'Tamil Nadu Public Service Commission Exam Preparation',
          icon: BookOpen,
            departments: [
              'TNPSC Group 1',
              'TNPSC Group 1A',
              'TNPSC Group 1B',
              'TNPSC Group 1C',
              'TNPSC Group 2',
              'TNPSC Group 2A',
              'TNPSC Group 4',
              'TNPSC Group 5A',
              'TNPSC Group 6',
              'TNPSC Group 7A',
              'TNPSC Group 7B',
              'TNPSC Group 8',
              'TNPSC VAO Preparation',
              'TNPSC General Tamil',
              'TNPSC General English',
              'TNPSC General Studies',
              'TNPSC Aptitude and Mental Ability',
              'TNPSC Indian History',
              'TNPSC Indian Polity',
              'TNPSC Indian Geography',
              'TNPSC Indian Economy',
              'TNPSC Indian National Movement',
              'TNPSC Tamil Nadu History',
              'TNPSC Tamil Nadu Culture',
              'TNPSC Science and Technology',
              'TNPSC Current Affairs',
              'TNPSC Previous Year Questions',
              'TNPSC Important Questions',
              'TNPSC Mock Tests',
              'TNPSC Chapter Wise Tests',
              'TNPSC Revision Notes',
              'TNPSC Study Plan',
              'TNPSC Question Bank',
              'TNPSC Practice Tests'

            ]
  },
  {
    id: 'rrb',
      titleKey: 'RRB Exams',
        descKey: 'Railway Recruitment Board exams preparation.',
          icon: Briefcase,
            departments: [
              'RRB NTPC Non-Technical',
              'RRB Group D',
              'RRB ALP (Assistant Loco Pilot)',
              'RRB JE (Junior Engineer CSE/ECE/Civil)',
              'RRB General Science & Reasoning'
            ]
  }
];

  export function HomePage() {
    const { language, paidToday } = useApp();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<CourseCategory | null>(null);
    const [deptSearch, setDeptSearch] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pendingCourseUrl, setPendingCourseUrl] = useState<string>('#/scan');

    // தற்போதைய மொழிக்குரிய சொற்களஞ்சியத்தைத் தேர்ந்தெடுத்தல்
    const t = translations[language] || translations['en'];

    // Mandatory Paywall Enforcement on Course Selection (With 24-hr persistence)
    const handleHeroScan = (e: React.MouseEvent) => {
      e.preventDefault();
      const target = '#/scan';
      const hasAccess = paidToday || isPaymentPassActive();
      if (!hasAccess) {
        setPendingCourseUrl(target);
        setShowPaymentModal(true);
      } else {
        window.location.hash = target;
      }
    };

    const handleSelectDepartment = (dept: string) => {
      if (!activeCategory) return;
      const target = `#/scan?course=${activeCategory.id}&dept=${encodeURIComponent(dept)}`;
      const hasAccess = paidToday || isPaymentPassActive();
      if (!hasAccess) {
        setPendingCourseUrl(target);
        setShowPaymentModal(true);
      } else {
        setActiveCategory(null);
        window.location.hash = target;
      }
    };

    const handlePaymentSuccess = () => {
      setShowPaymentModal(false);
      setActiveCategory(null);
      window.location.hash = pendingCourseUrl;
    };

    // சர்ச் மூலம் கோர்ஸ்களை வடிகட்டுதல்
    const filteredCategories = useMemo(() => {
      if (!searchQuery.trim()) return COURSE_CATEGORIES;

      const query = searchQuery.toLowerCase();
      return COURSE_CATEGORIES.filter(cat =>
        cat.titleKey.toLowerCase().includes(query) ||
        cat.descKey.toLowerCase().includes(query) ||
        cat.departments.some(dept => dept.toLowerCase().includes(query))
      );
    }, [searchQuery]);

    // பாப்அப் விண்டோவிற்குள் துறைகளை வடிகட்டுதல்
    const filteredDepartments = useMemo(() => {
      if (!activeCategory) return [];
      if (!deptSearch.trim()) return activeCategory.departments;
      return activeCategory.departments.filter(dept =>
        dept.toLowerCase().includes(deptSearch.toLowerCase())
      );
    }, [activeCategory, deptSearch]);

    return (
      <div className="space-y-8 animate-fade-up">
        {/* பிரகாசமான அட்ராக்டிவ் கலர்ஸ் மற்றும் புக்ஸ் இல்லஸ்ட்ரேஷன் கொண்ட பேனர் */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 via-indigo-700 to-purple-900 p-6 text-white shadow-2xl sm:p-10 border-2 border-white/20">
          <div className="absolute -right-16 -top-16 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" aria-hidden />
          <div className="absolute -left-16 -bottom-16 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" aria-hidden />

          <div className="grid lg:grid-cols-2 gap-8 items-center relative z-10">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-xs font-bold backdrop-blur-md text-amber-300 border border-white/30">
                <Sparkles className="h-4 w-4" /> Smart AI Learning Quest
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl leading-tight">
                {t.heroTitle}
              </h1>
              <p className="text-sm text-teal-100 sm:text-base leading-relaxed">
                {t.heroDesc}
              </p>
              <div className="flex flex-wrap gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleHeroScan}
                  className="btn-primary bg-gradient-to-r from-amber-400 to-amber-500 text-ink font-bold hover:from-amber-500 hover:to-amber-600 shadow-lg border-0 flex items-center gap-2 cursor-pointer"
                >
                  {t.scanPage} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="relative group">
                <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-amber-400 via-rose-400 to-teal-400 opacity-50 blur-lg group-hover:opacity-80 transition duration-500"></div>
                <div className="relative rounded-3xl bg-slate-900/70 p-4 border border-white/30 backdrop-blur-md">
                  <BookIllustration className="w-64 sm:w-72 animate-float" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* கோர்ஸ் தேர்வு மற்றும் தேடல் பகுதி */}
        <section className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-teal-600" />
                {t.chooseCourse}
              </h2>
              <p className="text-sm text-stone-500">{t.chooseDesc}</p>
            </div>

            {/* பிரதான தேடல் பெட்டி */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                className="w-full rounded-2xl border-2 border-teal-600/30 bg-white py-2.5 pl-10 pr-4 text-sm text-ink shadow-md outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* கோர்ஸ்கள் பட்டியல் */}
          {filteredCategories.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCategories.map((cat) => {
                const Icon = cat.icon;

                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setActiveCategory(cat);
                      setDeptSearch('');
                    }}
                    className="group cursor-pointer card flex flex-col justify-between p-6 transition-all duration-300 border-2 border-stone-200/80 bg-gradient-to-b from-white to-stone-50/50 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-teal-500"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 font-bold group-hover:bg-teal-600 group-hover:text-white transition-colors">
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                          {cat.departments.length} {t.deptFound}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-display text-xl font-bold text-ink group-hover:text-teal-700 transition-colors">
                          {cat.titleKey}
                        </h3>
                        <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                          {cat.descKey}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-stone-100 pt-4 flex items-center justify-between text-xs font-bold text-teal-700 group-hover:text-teal-800">
                      <span>{t.startStudying}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-stone-300 p-12 text-center bg-white shadow-sm">
              <p className="text-base font-semibold text-stone-600">{t.noCourses} "{searchQuery}".</p>
            </div>
          )}
        </section>

        {/* கோர்ஸைக் கிளிக் செய்தவுடன் திறக்கும் பாப்அப் விண்டோ (Department Search & Selection Modal) */}
        {activeCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border-2 border-teal-500 max-h-[90vh] flex flex-col">

              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div>
                  <h3 className="text-2xl font-extrabold text-ink">
                    {activeCategory.titleKey}
                  </h3>
                  <p className="text-xs text-stone-500">{t.modalSubtitle}</p>
                </div>
                <button
                  onClick={() => setActiveCategory(null)}
                  className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* டிபார்ட்மென்ட்டிற்கான பிரத்யேக சர்ச் பார் */}
              <div className="my-4 relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" />
                <input
                  type="text"
                  placeholder={t.searchDeptPlaceholder}
                  className="w-full rounded-xl border-2 border-teal-500/30 bg-stone-50 py-2.5 pl-10 pr-4 text-sm text-ink outline-none focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-600/10 transition-all font-medium"
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  autoFocus
                />
              </div>

              {/* டிபார்ட்மென்ட் பட்டியல் (இதனைத் தேர்ந்தெடுத்தால் மட்டுமே அடுத்த பக்கத்திற்குச் செல்லும்) */}
              <div className="overflow-y-auto space-y-2 pr-1 flex-1">
                {filteredDepartments.length > 0 ? (
                  filteredDepartments.map((dept, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelectDepartment(dept)}
                      className="w-full text-left flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/60 p-3.5 text-sm font-semibold text-stone-800 hover:border-teal-600 hover:bg-teal-50 hover:text-teal-900 transition-all group cursor-pointer"
                    >
                      <span>{dept}</span>
                      <span className="flex items-center gap-1 text-xs text-teal-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        {t.selectDeptAction} <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-stone-500">
                    No departments found matching "{deptSearch}".
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Mandatory Paywall Checkout Modal */}
        {showPaymentModal && (
          <PaymentDialog
            onClose={() => setShowPaymentModal(false)}
            onPaid={handlePaymentSuccess}
          />
        )}
      </div>
    );
  }