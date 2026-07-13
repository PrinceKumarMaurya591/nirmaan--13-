import React from 'react';
import { BookOpen, User, Briefcase, PlusCircle, CheckCircle2, IndianRupee, Hammer, FileSpreadsheet, Settings, ShieldCheck, Download, WifiOff, RefreshCcw, Smartphone, Users, ChevronRight, FileText, Database } from 'lucide-react';
import { useAppContext } from '../store';

export function UserManual() {
  const { state } = useAppContext();
  const isHi = state.language === 'hi';

  const sections = [
    {
      title: isHi ? '1. ऐप का परिचय (Introduction)' : '1. Introduction to App',
      icon: <BookOpen className="w-6 h-6 text-blue-500" />,
      content: isHi ? (
        <div className="space-y-3 text-slate-600 text-sm">
          <p>यह ऐप कंस्ट्रक्शन (Construction) और प्रोजेक्ट मैनेजमेंट को आसान बनाने के लिए बनाया गया है। इसमें मुंशी, ऑफिस स्टाफ और मालिक (Admin) सब एक साथ जुड़कर काम कर सकते हैं।</p>
          <p><strong>मुख्य फायदा:</strong> फील्ड (साइट) से मुंशी जो भी खर्चे या हाजिरी की एंट्री करेगा, वह सीधे ऑफिस/मालिक के पास 'मंजूरी' (Approval) के लिए जाएगी। जब मालिक उसे पास (Approve) करेगा, तभी वह पक्के खाते (Ledger) में जुड़ेगी।</p>
        </div>
      ) : (
        <div className="space-y-3 text-slate-600 text-sm">
          <p>This app is designed to simplify construction and project management. Munshi, Office Staff, and Owners (Admins) can collaborate seamlessly.</p>
          <p><strong>Main Benefit:</strong> Any expense or attendance entered by the Munshi from the field will go to the Office/Owner for 'Approval'. Only when the Admin approves it, will it be added to the final Ledger.</p>
        </div>
      )
    },
    {
      title: isHi ? '2. रोल्स और उनके अधिकार (Roles & Permissions)' : '2. Roles & Permissions',
      icon: <ShieldCheck className="w-6 h-6 text-purple-500" />,
      content: isHi ? (
        <ul className="space-y-4 text-sm text-slate-600">
          <li className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <strong className="text-slate-800 flex items-center gap-2"><User className="w-4 h-4 text-blue-600"/> मुंशी / Site Incharge:</strong> 
            इनका काम सिर्फ साइट से एंट्री करना है (जैसे: लेबर की हाजिरी, सामान आना, और पेटी कैश के खर्चे)। ये किसी पुरानी एंट्री को डिलीट नहीं कर सकते और न ही पूरे प्रोजेक्ट का बैलेंस देख सकते हैं (सिर्फ अपना पेटी कैश देख सकते हैं)।
          </li>
          <li className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <strong className="text-slate-800 flex items-center gap-2"><User className="w-4 h-4 text-emerald-600"/> ऑफिस स्टाफ (Office Staff):</strong> 
            ये प्रोजेक्ट्स देख सकते हैं, वेंडर और ठेकेदार का हिसाब रख सकते हैं, लेकिन ऐप की अहम सेटिंग्स या यूजर डिलीट करने का अधिकार इन्हें नहीं होता।
          </li>
          <li className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <strong className="text-slate-800 flex items-center gap-2"><User className="w-4 h-4 text-amber-600"/> एडमिन / Super Admin:</strong> 
            ये ऐप के मालिक हैं। इनके पास सारे अधिकार हैं। ये नए यूजर बना सकते हैं, मुंशी की एंट्री को पास या रिजेक्ट कर सकते हैं, और पूरा खाता (Financials) देख सकते हैं।
          </li>
        </ul>
      ) : (
        <ul className="space-y-4 text-sm text-slate-600">
          <li className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <strong className="text-slate-800 flex items-center gap-2"><User className="w-4 h-4 text-blue-600"/> Munshi / Site Incharge:</strong> 
            Their job is to make entries from the site (e.g., labor attendance, material arrival, petty cash expenses). They cannot delete old entries or see the overall project financials (they only see their petty cash).
          </li>
          <li className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <strong className="text-slate-800 flex items-center gap-2"><User className="w-4 h-4 text-emerald-600"/> Office Staff:</strong> 
            They can view projects, manage vendor and subcontractor ledgers, but lack the authority to change critical app settings or delete users.
          </li>
          <li className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <strong className="text-slate-800 flex items-center gap-2"><User className="w-4 h-4 text-amber-600"/> Admin / Super Admin:</strong> 
            They are the owners of the app. They have all rights. They can create new users, approve/reject Munshi's entries, and view all financials.
          </li>
        </ul>
      )
    },
    {
      title: isHi ? '3. फील्ड एंट्री कैसे करें? (मुंशी के लिए)' : '3. How to make Field Entries? (For Munshi)',
      icon: <Smartphone className="w-6 h-6 text-emerald-500" />,
      content: isHi ? (
        <div className="space-y-3 text-sm text-slate-600">
          <p>नीचे दिए गए 'प्लस' (+) बटन (Entry) पर क्लिक करें। वहां आपको तीन ऑप्शन मिलेंगे:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Material (सामान):</strong> जब साइट पर कोई नया सामान आए (जैसे: ईंट, सीमेंट)। आप सामान की फोटो, बिल की फोटो और गाड़ी का नंबर भी डाल सकते हैं।</li>
            <li><strong>Labor (मजदूर):</strong> दिहाड़ी मजदूरों की हाजिरी लगाने और उन्हें एडवांस पैसे देने के लिए।</li>
            <li><strong>Petty Cash (नकद खर्च):</strong> चाय, पानी, किराया जैसे छोटे-मोटे खर्चे जो मुंशी अपने पास मौजूद कैश से करता है।</li>
          </ul>
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mt-3 text-amber-800">
            <strong>नोट:</strong> एंट्री करने के बाद वह तुरंत खाते में नहीं जुड़ेगी। वह 'Pending' में जाएगी जब तक मालिक उसे पास (Approve) न कर दे।
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-slate-600">
          <p>Click the 'Plus' (+) button (Entry) at the bottom. You will find three options:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Material:</strong> When new material arrives at the site (e.g., bricks, cement). You can upload photos of the material, bills, and vehicle number.</li>
            <li><strong>Labor:</strong> To mark attendance for daily wage laborers and give them advances.</li>
            <li><strong>Petty Cash:</strong> For small expenses like tea, water, or transport fare made by Munshi from their cash in hand.</li>
          </ul>
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mt-3 text-amber-800">
            <strong>Note:</strong> After making an entry, it won't be added to the ledger immediately. It goes to 'Pending' until the owner approves it.
          </div>
        </div>
      )
    },
    {
      title: isHi ? '4. एंट्री को पास/रिजेक्ट करना (एडमिन के लिए)' : '4. Approving/Rejecting Entries (For Admin)',
      icon: <CheckCircle2 className="w-6 h-6 text-amber-500" />,
      content: isHi ? (
        <div className="space-y-3 text-sm text-slate-600">
          <p>मुंशी जो भी एंट्री करता है, वह आपको <strong>"Approval Queue" (मंजूरी अनुरोध)</strong> में दिखेगी।</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>मेनू से "Approval Queue" खोलें।</li>
            <li>हर एंट्री को ध्यान से देखें (कितना सामान आया, कितने पैसे खर्च हुए)।</li>
            <li>अगर सब सही है, तो <strong>Approve (✅)</strong> पर क्लिक करें। यह एंट्री पक्के खाते में जुड़ जाएगी।</li>
            <li>अगर कुछ गलत है, तो कारण लिखकर <strong>Reject (❌)</strong> करें। एंट्री रद्द हो जाएगी और खाते में नहीं जुड़ेगी।</li>
          </ol>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-slate-600">
          <p>Whatever entry the Munshi makes, you will see it in the <strong>"Approval Queue"</strong>.</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Open "Approval Queue" from the menu.</li>
            <li>Review each entry carefully (quantity of material, amount spent).</li>
            <li>If everything is correct, click <strong>Approve (✅)</strong>. It will be added to the final ledger.</li>
            <li>If something is wrong, write a reason and <strong>Reject (❌)</strong> it. It will be canceled and won't affect the ledger.</li>
          </ol>
        </div>
      )
    },
    {
      title: isHi ? '5. सप्लायर और ठेकेदार का हिसाब (Ledger)' : '5. Supplier & Subcontractor Ledger',
      icon: <FileSpreadsheet className="w-6 h-6 text-indigo-500" />,
      content: isHi ? (
        <div className="space-y-3 text-sm text-slate-600">
          <p>प्रोजेक्ट के अंदर <strong>"Supplier Ledger"</strong> और <strong>"Subcontractor Tracker"</strong> का विकल्प होता है।</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Supplier (दुकानदार):</strong> यहां आप देख सकते हैं कि किस दुकानदार से कितना सामान आया, उसका कुल बिल कितना बना, आपने उसे कितना पेमेंट किया है, और कितना बकाया (Balance) है। आप सीधे यहीं से नया पेमेंट भी जोड़ सकते हैं।</li>
            <li><strong>Subcontractor (ठेकेदार):</strong> यहां आप पेटी-ठेकेदारों (जैसे: पेंटर, प्लंबर, शटरिंग वाले) का हिसाब रख सकते हैं। उनका काम कितना हुआ (Work Log), और उन्हें कितने पैसे दिए गए (Payments), सब यहाँ दर्ज होता है।</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-slate-600">
          <p>Inside a project, you have <strong>"Supplier Ledger"</strong> and <strong>"Subcontractor Tracker"</strong> options.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Supplier:</strong> View how much material came from which vendor, their total bill, payments made by you, and the pending balance. You can also add new payments directly from here.</li>
            <li><strong>Subcontractor:</strong> Keep track of petty-contractors (e.g., painters, plumbers, shuttering). Record how much work they completed (Work Log) and the money given to them (Payments).</li>
          </ul>
        </div>
      )
    },
    {
      title: isHi ? '6. यूजर और पेटी कैश मैनेजमेंट' : '6. User & Petty Cash Management',
      icon: <Users className="w-6 h-6 text-rose-500" />,
      content: isHi ? (
        <div className="space-y-3 text-sm text-slate-600">
          <p>मेनू में <strong>"Staff Management" (स्टाफ और अनुमतियां)</strong> पर जाएं:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>नया यूजर बनाना:</strong> 'Add User' बटन से नया स्टाफ या मुंशी जोड़ें। उनका फोन नंबर, पिन और रोल सेट करें।</li>
            <li><strong>प्रोजेक्ट असाइन करना:</strong> मुंशी सिर्फ उन्हीं प्रोजेक्ट्स को देख सकता है जो आपने उसे असाइन किए हैं।</li>
            <li><strong>पेटी कैश (Petty Cash):</strong> आप मुंशी को छोटे खर्चों के लिए डिजिटल रूप से कैश अलॉट कर सकते हैं। मुंशी जब भी पेटी कैश से खर्चा करेगा, तो उसका बैलेंस अपने आप कम हो जाएगा।</li>
            <li><strong>पिन रीसेट:</strong> अगर कोई स्टाफ अपना पासवर्ड भूल जाता है, तो एडमिन यहाँ से उसका पिन बदल सकता है।</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-slate-600">
          <p>Go to <strong>"Staff Management"</strong> in the menu:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Create New User:</strong> Add new staff or Munshi via 'Add User'. Set their phone, PIN, and role.</li>
            <li><strong>Assign Projects:</strong> Munshi can only see and enter data for projects assigned to them.</li>
            <li><strong>Petty Cash:</strong> You can digitally allot cash to Munshi for small expenses. Whenever Munshi logs a petty cash expense, their balance decreases automatically.</li>
            <li><strong>Reset PIN:</strong> If a staff forgets their password, Admin can change their PIN from here.</li>
          </ul>
        </div>
      )
    },
    {
      title: isHi ? '7. रद्दी टोकरी (Recycle Bin)' : '7. Recycle Bin (Data Recovery)',
      icon: <Database className="w-6 h-6 text-slate-600" />,
      content: isHi ? (
        <div className="space-y-3 text-sm text-slate-600">
          <p>गलती से कोई महत्वपूर्ण डेटा डिलीट हो गया? चिंता न करें!</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>एडमिन <strong>"Recycle Bin"</strong> में जाकर डिलीट की गई किसी भी चीज (सामान, लेबर, पेमेंट, ठेकेदार की एंट्री) को देख सकता है।</li>
            <li>वहां से आप डेटा को <strong>Restore (पुनर्स्थापित)</strong> कर सकते हैं, जिससे वह वापस अपनी जगह पर आ जाएगा।</li>
            <li>आप चाहें तो उसे हमेशा के लिए <strong>Permanently Delete</strong> भी कर सकते हैं।</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-slate-600">
          <p>Accidentally deleted important data? Don't worry!</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Admins can go to the <strong>"Recycle Bin"</strong> to view any deleted item (material, labor, payment, subcontractor entry).</li>
            <li>You can <strong>Restore</strong> the data from there, and it will go back to its original place.</li>
            <li>Or you can choose to <strong>Permanently Delete</strong> it.</li>
          </ul>
        </div>
      )
    },
    {
      title: isHi ? '8. ऑफलाइन काम और सिंकिंग (Offline Mode)' : '8. Offline Mode & Syncing',
      icon: <WifiOff className="w-6 h-6 text-teal-500" />,
      content: isHi ? (
        <div className="space-y-3 text-sm text-slate-600">
          <p>निर्माण स्थलों (Sites) पर अक्सर इंटरनेट नहीं होता है।</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>आप बिना इंटरनेट के भी ऐप खोल सकते हैं, डेटा देख सकते हैं और नई एंट्री कर सकते हैं।</li>
            <li>जब आप बिना नेट के एंट्री करते हैं, तो ऐप के ऊपर <strong>"Offline/Syncing..."</strong> लिखा आता है और डेटा आपके फोन में सेव हो जाता है।</li>
            <li>जैसे ही आपके फोन में इंटरनेट आएगा, ऐप अपने आप वह सारा डेटा सर्वर पर भेज देगा (Sync कर देगा)। कोई भी काम नहीं रुकेगा!</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-slate-600">
          <p>Construction sites often lack good internet.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>You can open the app, view data, and make new entries even without the internet.</li>
            <li>When you make an entry offline, the app shows <strong>"Offline/Syncing..."</strong> at the top and saves the data on your phone.</li>
            <li>As soon as your phone gets internet, the app will automatically send (Sync) all that data to the server. Work never stops!</li>
          </ul>
        </div>
      )
    },
    {
      title: isHi ? '9. रिपोर्ट्स और एक्सपोर्ट (Reports & Download)' : '9. Reports & Export',
      icon: <Download className="w-6 h-6 text-sky-500" />,
      content: isHi ? (
        <div className="space-y-3 text-sm text-slate-600">
          <p>हिसाब-किताब का प्रिंट आउट निकालना हो या किसी को भेजना हो, तो रिपोर्ट्स का इस्तेमाल करें:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>प्रोजेक्ट के अंदर <strong>PDF</strong> या <strong>Excel</strong> बटन पर क्लिक करें।</li>
            <li>पूरी डिटेल (कितने का सामान आया, किसको कितने पैसे दिए गए, कुल खर्च) एक साफ-सुथरी फाइल में डाउनलोड हो जाएगी।</li>
            <li>आप इस फाइल को सीधे WhatsApp या Email पर शेयर कर सकते हैं।</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-slate-600">
          <p>Use reports to print accounts or send them to someone:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Inside a project, click the <strong>PDF</strong> or <strong>Excel</strong> button.</li>
            <li>The complete details (material cost, payments made, total expense) will download in a neat file.</li>
            <li>You can share this file directly via WhatsApp or Email.</li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2 opacity-60"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -z-10 -translate-x-1/2 translate-y-1/2 opacity-60"></div>
        
        <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-800 mb-2 tracking-tight">
          {isHi ? 'विस्तृत उपयोगकर्ता नियमावली' : 'Detailed User Manual'}
        </h1>
        <p className="text-slate-500 text-sm sm:text-base max-w-2xl mx-auto">
          {isHi 
            ? 'इस गाइड में ऐप के हर एक फीचर को बहुत ही आसान और सरल भाषा में गहराई से समझाया गया है। इसे पढ़कर कोई भी ऐप चलाना सीख सकता है।' 
            : 'This guide deeply explains every feature of the app in very easy and simple language. Anyone can learn to use the app by reading this.'}
        </p>
      </div>

      {/* Manual Sections */}
      <div className="space-y-6">
        {sections.map((section, idx) => (
          <section key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 shrink-0">
                {section.icon}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 leading-tight">
                {section.title}
              </h2>
            </div>
            <div className="p-5 sm:p-6">
              {section.content}
            </div>
          </section>
        ))}
      </div>

      {/* Need More Help Section */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden shadow-lg mt-8">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl -z-10"></div>
        <h2 className="text-xl sm:text-2xl font-bold mb-3">{isHi ? 'क्या अब भी कोई दिक्कत आ रही है?' : 'Still need help?'}</h2>
        <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto mb-6">
          {isHi 
            ? 'अगर आपको ऐप इस्तेमाल करने में कोई भी परेशानी आ रही है, तो अपने एडमिन या सुपर एडमिन से संपर्क करें। ऐप को बहुत ही आसान बनाने की कोशिश की गई है ताकि आपका काम तेजी से हो सके।' 
            : 'If you are facing any issues using the app, please contact your Admin or Super Admin. The app has been designed to be as simple as possible to speed up your work.'}
        </p>
        <div className="inline-flex items-center justify-center gap-2 bg-white/10 px-4 py-2 rounded-lg text-amber-400 font-medium">
          <Settings className="w-5 h-5" /> {isHi ? 'सिस्टम सपोर्ट' : 'System Support'}
        </div>
      </div>
    </div>
  );
}
