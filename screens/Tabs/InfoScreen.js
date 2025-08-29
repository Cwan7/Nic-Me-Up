import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { auth, db } from '../../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function InfoScreen({ navigation, route }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOnboarding = route?.params?.fromOnboarding;

  const goToIndex = (index) => {
    if (!flatListRef.current) return;
    flatListRef.current.scrollToOffset({ offset: index * width, animated: true });
    setCurrentIndex(index);
  };

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      goToIndex(currentIndex + 1);
      return;
    }

    if (isOnboarding) {
      if (isSubmitting) return;
      setIsSubmitting(true);

      try {
        const user = auth.currentUser;
        if (!user) {
          Alert.alert('Not signed in', 'Please sign in to continue.');
          setIsSubmitting(false);
          return;
        }

        const userRef = doc(db, 'users', user.uid);
        await setDoc(
          userRef,
          {
            onboardingComplete: true,
            onboardingCompletedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        console.error('Error finishing onboarding:', err);
        Alert.alert('Error', 'Something went wrong saving your progress. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      goToIndex(0);
    }
  };

  const renderSlide = ({ item }) => (
  <View style={[styles.slide, { width }]}>
    <Text style={styles.title}>{item.title}</Text>
    {typeof item.text === 'string' ? (
    <Text style={styles.text}>{item.text}</Text>
    ) : (
    item.text
    )}
    <Image
      source={typeof item.image === 'string' ? { uri: item.image } : item.image}
      style={[styles.slideImage, item.imageStyle]} 
      resizeMode="contain"
    />
    <View style={styles.detailsContainer}>
    {item.details.map((detail, index) =>
        typeof detail === "string" ? (
        <Text key={index} style={styles.detailText}>- {detail}</Text>
        ) : (
        <View key={index}>{detail}</View>
        )
    )}
    </View>
  </View>
);

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        extraData={currentIndex}
      />

      <View style={styles.dotsContainer}>
        {slides.map((slide, index) => (
          <View key={slide.id} style={[styles.dot, index === currentIndex ? styles.dotActive : null]} />
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleNext}
          style={[styles.button, isSubmitting && { opacity: 0.7 }]}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {currentIndex === slides.length - 1
                ? isOnboarding ? 'Get Started' : 'Next'
                : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  slide: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  slideImage: { width: 600, height: 400, marginBottom: 5 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  text: { fontSize: 16, textAlign: 'center', marginBottom: 10 },
  detailsContainer: { marginTop: 5 },
  detailText: { fontSize: 14, textAlign: 'center', marginVertical: 2 },
  footer: { padding: 10, alignItems: 'center' },
  button: { backgroundColor: '#1E90FF', padding: 12, borderRadius: 10, width: 200, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd', marginHorizontal: 10 },
  dotActive: { backgroundColor: '#1E90FF' },
  highlight: {color: '#1E90FF', fontWeight: 'bold'}
});

const slides = [
  { 
    id: '1', 
    title: 'Welcome to NicMeUp', 
    image: require('../../assets/Logo3.png'), 
    imageStyle: { width: 300, height: 300 },
    text: 'A nicotine pouch sharing app', 
    details: ['Connect with nearby users.', 'Share pouches', 'Make Friends'] 
  },
  { 
    id: '2', 
    title: 'Home Screen', 
    image: require('../../assets/HomeScreenSS.jpeg'),  
    text: (
      <Text style={styles.text}>
        Need a pouch? Tap the NicMeUp button!{" "}
        <Text style={styles.highlight}>Allow Location Permissions</Text>
      </Text>
    ),
    details: [`Blue circle is the distance you're willing to walk.`,'Red pins are nearby user/active Assist locations.', 
        'NicMeUp button will notify those users.',] 
  },
  { 
    id: '3', 
    title: 'Assist', 
    image: require ('../../assets/AssistModalSS.jpeg'), 
    text: (
      <Text style={styles.text}>
        Help others!{" "}
        <Text style={styles.highlight}>Enable Notifications</Text>
      </Text>
    ),
    details: ['Receive NicMeUp requests.', 'Accept or decline instantly.', 'Build your rating.'] 
  },
  { 
    id: '4', 
    title: 'NicMeUp Session', 
    image: require ('../../assets/NicMeUpSessionSS.jpeg'),  
    text: `When a connection is made, you'll see`, 
    details: ['Your locations are shared with eachother', 'Assister details will be shown', 
        `Send messages by hitting the chat icon`, `A prompt will show when close to eachother`,] 
  },
  { 
  id: '5', 
  title: 'Settings Page', 
  image: require ('../../assets/SettingsSS.jpeg'), 
  text: 'Customize your settings', 
  details: [
    (
      <Text style={styles.detailText}>
        Set distance preferences for <Text style={{ fontWeight: 'bold' }}>your</Text> NicMeUp's
      </Text>
    ),
    (
      <Text style={styles.detailText}>
        Set Assist address's to recieve <Text style={{ fontWeight: 'bold' }}>others</Text> NicMeUp's
      </Text>
    ),
    "Toggle Assist to active",
    "Rename or Delete address's"
  ] 
},
  { 
    id: '6', 
    title: 'Profile Page', 
    image: require ('../../assets/ProfileSS.jpeg'),  
    text: 'Your personal profile page', 
    details: ['Edit personal details for Assist.', 'Pouches, Strength, Flavors and Notes', `Details will be shown to NicMeUp's`] 
  },
];