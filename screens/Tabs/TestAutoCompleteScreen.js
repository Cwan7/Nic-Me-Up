import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, StyleSheet, Text } from 'react-native';
import { GOOGLE_API_KEY } from '@env';

export default function TestAutocomplete() {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    console.log('Input changed, fetching:', input);
    if (input.length > 2) {
      fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&components=country:us&key=${GOOGLE_API_KEY}`)
        .then((response) => response.json())
        .then((data) => {
          console.log('Fetch Response:', data);
          setSuggestions(data.predictions || []);
        })
        .catch((error) => console.log('Fetch Error:', error));
    } else {
      setSuggestions([]);
    }
  }, [input]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Enter address"
        value={input}
        onChangeText={setInput}
        onFocus={() => console.log('Input focused')}
      />
      {selected && <Text style={styles.selected}>Selected: {selected}</Text>}
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.place_id}
        renderItem={({ item }) => (
          <View style={styles.suggestion}>
            <Text
              onPress={() => {
                console.log('Selected:', item.description);
                setSelected(item.description);
              }}
              style={styles.suggestionText}
            >
              {item.structured_formatting.main_text} {item.structured_formatting.secondary_text}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text>No suggestions</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  input: { height: 50, fontSize: 16, paddingHorizontal: 10, borderWidth: 1, borderColor: '#60a8b8', borderRadius: 8 },
  suggestion: { padding: 10, borderBottomWidth: 1, borderColor: '#60a8b8' },
  suggestionText: { color: '#000' },
  selected: { marginTop: 10, fontSize: 16, color: '#60a8b8' },
});