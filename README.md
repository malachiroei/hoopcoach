# HoopCoach - מאמן כדורסל חכם

אפליקציית מובייל (Expo SDK 51 + React Native) שעוקבת אחרי אימוני כדורסל באמצעות המצלמה, מספקת סטטיסטיקות בזמן אמת, יוצרת היילייטס ונותנת המלצות לשיפור.

## דרישות

- Node.js 18+
- Expo SDK **51** (React Native 0.74)
- Dev Client נדרש למצלמה ומודולים native

## התקנה

```bash
npm install
```

## הרצה (פיתוח)

```bash
# Expo Go — מסכי UI בלבד (ללא מצלמה native מלאה)
npm start

# Dev Client — נדרש למצלמה + TFLite
npm run start:dev-client
```

## בניית Dev Client (חובה אחרי שינוי native)

```bash
npm install
npm run build:dev:android
npm run build:dev:ios
```

## מבנה הפרויקט

- `app/` — מסכים (expo-router)
- `src/cv/` — מנוע זיהוי זריקות (ballTracker, shotDetector, courtMapper)
- `src/services/` — SQLite, סטטיסטיקות, היילייטס, המלצות
- `src/components/` — רכיבי UI
- `src/models/` — מודל TFLite (לאחר אימון)
- `scripts/train_model.py` — אימון YOLO והמרה ל-TFLite

## מודל CV

עד להוספת `basketball_detector.tflite`, האפליקציה משתמשת ב-mock detector לפיתוח.
לאימון המודל:

```bash
pip install ultralytics tensorflow
python scripts/train_model.py
```

## שימוש

1. פתח את האפליקציה והשלם את ההדרכה
2. הצב את הטלפון על חצובה (זווית קבועה על הסל)
3. כייל את המגרש (4 נקודות)
4. התחל אימון — הסטטיסטיקות מתעדכנות בזמן אמת
5. בסיום — צפה בסיכום, heat map, היילייטס והמלצות

## טכנולוגיות

- Expo SDK **51** + Dev Client
- react-native-vision-camera
- react-native-fast-tflite
- expo-sqlite
- react-native-reanimated
- i18next (עברית RTL)
