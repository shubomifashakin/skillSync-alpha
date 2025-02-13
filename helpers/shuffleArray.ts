// Shuffle function to randomize array elements, return the shuffled array -- FISHER YATES ALGORITHM
export function shuffleArray<T>(array: T[]): T[] {
  //the array starts at the end and swaps with a random element between the start and the current element
  for (let i = array.length - 1; i > 0; i--) {
    //select a random index between 0 and i
    const j = Math.floor(Math.random() * i);

    //swap the current element with the element at the random index
    [array[i], array[j]] = [array[j], array[i]];
  }

  //return the shuffled array
  return array;
}
