// Shuffle function to randomize array elements, return the shuffled array
export function shuffleArray<T>(array: T[]): T[] {
  //the array starts at the end and swaps with a random index
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    //swap the current element with the element at the random index
    [array[i], array[j]] = [array[j], array[i]];
  }

  //return the shuffled array
  return array;
}
