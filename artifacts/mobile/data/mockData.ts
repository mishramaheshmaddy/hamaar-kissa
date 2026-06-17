import { AudioStory } from "@/context/AudioContext";

export interface VideoItem {
  id: string;
  title: string;
  category: string;
  categoryId?: number;
  views: string;
  likes: number;
  creator: string;
  thumbnail: string;
  duration: number;
  description: string;
  youtubeId?: string;
  videoUrl?: string;
  sourceType?: string;
}

export const AUDIO_CATEGORIES = [
  { id: "all", label: "सब", icon: "grid" },
  { id: "horror", label: "भूत-प्रेत", icon: "moon" },
  { id: "village", label: "गाँव के कहानी", icon: "home" },
  { id: "emotional", label: "दिल के बात", icon: "heart" },
  { id: "devotional", label: "भक्ति", icon: "star" },
  { id: "mythological", label: "पुरनिया कथा", icon: "book" },
  { id: "love", label: "प्रेम कहानी", icon: "heart" },
  { id: "crime", label: "क्राइम", icon: "alert-circle" },
  { id: "motivation", label: "हिम्मत", icon: "zap" },
  { id: "kids", label: "लइका के", icon: "smile" },
];

export const VIDEO_CATEGORIES = [
  { id: "all", label: "सब" },
  { id: "comedy", label: "हँसी" },
  { id: "motivation", label: "हिम्मत" },
  { id: "folk", label: "लोकगीत" },
  { id: "village", label: "गाँव" },
  { id: "devotional", label: "भक्ति" },
  { id: "drama", label: "नाटक" },
  { id: "emotional", label: "दिल के छुए" },
];

export const MOCK_STORIES: AudioStory[] = [
  {
    id: "s1",
    title: "भूतहा हवेली",
    category: "horror",
    duration: 1200,
    thumbnail: "horror",
    narrator: "रामदेव पांडेय",
    description: "एक पुरान हवेली में रहे वाला भूत के डेरावनी कहानी।",
  },
  {
    id: "s2",
    title: "माई के ममता",
    category: "emotional",
    duration: 900,
    thumbnail: "emotional",
    narrator: "सुनीता देवी",
    description: "एक माई आ बेटा के रिश्ता के भावुक कहानी।",
  },
  {
    id: "s3",
    title: "गाँव के दुलहिन",
    category: "village",
    duration: 1500,
    thumbnail: "village",
    narrator: "सुरेश गुप्ता",
    description: "बिहार के एक छोट गाँव के मीठी प्रेम कहानी।",
  },
  {
    id: "s4",
    title: "हनुमान जी के कृपा",
    category: "devotional",
    duration: 720,
    thumbnail: "devotional",
    narrator: "पंडित शिव प्रसाद",
    description: "हनुमान जी के भक्ति से जुड़ल एक चमत्कारी कहानी।",
  },
  {
    id: "s5",
    title: "राधा-कृष्ण के प्रेम लीला",
    category: "mythological",
    duration: 1800,
    thumbnail: "mythological",
    narrator: "मधु शर्मा",
    description: "वृन्दावन के अनोखी प्रेम के कहानी।",
  },
  {
    id: "s6",
    title: "चोर आ पुलिस",
    category: "crime",
    duration: 1350,
    thumbnail: "crime",
    narrator: "विजय सिंह",
    description: "एक जाँबाज पुलिस अफसर के रोमांचक कहानी।",
  },
  {
    id: "s7",
    title: "सफलता के राज",
    category: "motivation",
    duration: 600,
    thumbnail: "motivation",
    narrator: "अनिल कुमार",
    description: "जिनगी में आगे बढ़े के लेल प्रेरणादायक बात।",
  },
  {
    id: "s8",
    title: "चंदा मामा के कहानी",
    category: "kids",
    duration: 480,
    thumbnail: "kids",
    narrator: "नीता देवी",
    description: "लइका सब के मजेदार आ सीख देवे वाली कहानी।",
  },
  {
    id: "s9",
    title: "तोहरी याद में",
    category: "love",
    duration: 1080,
    thumbnail: "love",
    narrator: "कविता सिंह",
    description: "दिल के छू लेवे वाली भोजपुरी प्रेम कहानी।",
  },
  {
    id: "s10",
    title: "प्रेतात्मा के बदला",
    category: "horror",
    duration: 1440,
    thumbnail: "horror",
    narrator: "रामदेव पांडेय",
    description: "एक बेकसूर आत्मा के बदला के कहानी।",
  },
  {
    id: "s11",
    title: "बाबा के आशीर्वाद",
    category: "devotional",
    duration: 840,
    thumbnail: "devotional",
    narrator: "पंडित शिव प्रसाद",
    description: "काशी विश्वनाथ के महिमा आ एक भक्त के श्रद्धा।",
  },
  {
    id: "s12",
    title: "किसान के जिद",
    category: "village",
    duration: 1260,
    thumbnail: "village",
    narrator: "सुरेश गुप्ता",
    description: "एक मेहनती किसान के संघर्ष आ जीत के कहानी।",
  },
];

export const MOCK_VIDEOS: VideoItem[] = [
  {
    id: "v1",
    title: "भोजपुरी हँसी - नेता जी के चुनाव",
    category: "comedy",
    views: "2.3M",
    likes: 45000,
    creator: "Ramu Kaka",
    thumbnail: "comedy",
    duration: 60,
    description: "गाँव के नेता जी के मजेदार चुनाव प्रचार 😂",
  },
  {
    id: "v2",
    title: "मेहनत के फल",
    category: "motivation",
    views: "890K",
    likes: 23000,
    creator: "Motivational Guru",
    thumbnail: "motivation",
    duration: 45,
    description: "जिनगी में कबहूँ हार मत मानऽ",
  },
  {
    id: "v3",
    title: "सावन के झूला",
    category: "folk",
    views: "1.5M",
    likes: 67000,
    creator: "Chhath Geet Official",
    thumbnail: "folk",
    duration: 75,
    description: "पारंपरिक भोजपुरी लोकगीत",
  },
  {
    id: "v4",
    title: "गाँव के साँझ",
    category: "village",
    views: "3.1M",
    likes: 89000,
    creator: "Village Life",
    thumbnail: "village_life",
    duration: 55,
    description: "बिहार के गाँव के सुन्दर साँझ",
  },
  {
    id: "v5",
    title: "आरती - जय गणेश देवा",
    category: "devotional",
    views: "4.2M",
    likes: 120000,
    creator: "Bhakti Channel",
    thumbnail: "devotional_video",
    duration: 90,
    description: "पवित्र गणेश आरती",
  },
  {
    id: "v6",
    title: "ससुराल के नाटक",
    category: "drama",
    views: "2.7M",
    likes: 54000,
    creator: "Drama Queen",
    thumbnail: "drama",
    duration: 85,
    description: "ससुराल के हँसी-खुशी",
  },
  {
    id: "v7",
    title: "बेटी के विदाई",
    category: "emotional",
    views: "5.8M",
    likes: 198000,
    creator: "Dil Ki Baat",
    thumbnail: "emotional_video",
    duration: 70,
    description: "दिल के रुला देवे वाली विदाई",
  },
  {
    id: "v8",
    title: "मुर्गा लड़ाई - पंचायत के हँसी",
    category: "comedy",
    views: "1.9M",
    likes: 41000,
    creator: "Ramu Kaka",
    thumbnail: "comedy2",
    duration: 55,
    description: "पंचायत के अनोखी लड़ाई",
  },
];

export const HOME_SECTIONS = [
  { id: "trending", title: "आजु के चर्चित", type: "audio" as const },
  { id: "continue", title: "जारी राखीं", type: "continue" as const },
  { id: "new_stories", title: "नया कहानी", type: "audio" as const },
  { id: "viral_videos", title: "वायरल वीडियो", type: "video" as const },
  { id: "devotional", title: "भक्ति", type: "audio" as const },
  { id: "horror", title: "भूत-प्रेत के कहानी", type: "audio" as const },
];
