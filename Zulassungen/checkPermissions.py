'''
Created on 30.10.2014

@author: Falk Wilke
@author: Nils Baumgartner (adaptions for Mac and Python)
A simple skript checking the permissions of students.
'''
# !/usr/local/bin/python2.7
# encoding: utf-8


## USAGE: python3 checkPermissions.py --display yes --out ./result.csv ./check.csv


import sys
import os

from argparse import ArgumentParser
from argparse import RawDescriptionHelpFormatter
import argparse
import re

__all__ = []

DEBUG = 1
TESTRUN = 0
PROFILE = 0
SEPARATOR_CHAR = ";"
DEFAULT_EXTENSION = "csv"
DEFAULT_TEXT = "zulassungen"


def matchAgainstData(searchList, dataFileNames, printOption, resultFile=None):
    """
    Matches the given searchList against the data drawn from the files denoted by dataFileNames.  Will parse ALL those files before starting the search.
    printOption is responsible for printing those students who have (True) or who don't have (False) permission.
    The latter will be drawn from the searchList itself, since there is not data available. 
    This is a consequence of the files containing only students who DO have permission. 
    So the search-request itself is the only available source for printing those.
    resultfile is used for printing purposes.
    
    Parameters
    ----------
    searchList: list
        holding all keys for searching, e.g. Sorglos;Susi;123456
    dataFileNames: list
        holding all filenames denoting the data to be processed
    printOption: boolean
        denotes which 'kind' of student shall be printed (True- those with permission, False- those without)
    resultFile: str
        the file the output shall be appended to. Default is None, the standard output is used in this case
    """
    printerFileStream = None
    lines = []
    unique_matchingCells = []  # New list to hold unique values

    if resultFile != None:
        if os.path.exists(resultFile):
            os.remove(resultFile)

        printerFileStream = open(resultFile, "a", encoding='utf-8')

    for dataFile in dataFileNames:
        with open(dataFile, "r", encoding='utf-8') as dataFileStream:
            newLines = dataFileStream.readlines();
            lines += newLines;

    print("lines")
    print(lines)
    print("---")

    print("searchList")
    print(searchList)
    

    # OLD: Made sorting by lines, which is cronologic
    #if printOption:
    #    matchingCells = [line.strip() for line in lines if any(line.strip().startswith(s.strip()) for s in searchList)]
    #else:
    #    matchingCells = [s.strip() for s in searchList if
    #                     all(not (line.strip().startswith(s.strip())) for line in lines)]

    # NEW: Sorts by the input list given: searchList
    # Find matches
    matchingCells = []
    for search_item in searchList:
        if printOption:  # Find items in lines that start with search_item
            matches = [line.strip() for line in lines if line.strip().startswith(search_item.strip())]
            matchingCells.extend(matches)
        else:  # Find items in searchList not in lines
            if not any(line.strip().startswith(search_item.strip()) for line in lines):
                matchingCells.append(search_item.strip())


    print("---")
    print("matchingCells")
    print(matchingCells)
    # Sort the matchingCells alphabetically, ignoring case
    # matchingCells.sort(key=lambda x: x.split(SEPARATOR_CHAR)[0].lower())

    # Filter duplicates while maintaining the order
    for cell in matchingCells:
        if cell not in unique_matchingCells:
            unique_matchingCells.append(cell)

    for matchingCell in unique_matchingCells:
        cells = matchingCell.split(SEPARATOR_CHAR);

        if printerFileStream != None:
            toPrint = cells[0] + SEPARATOR_CHAR + cells[1]
            if len(cells) > 2:
                toPrint += SEPARATOR_CHAR + cells[2]
                printerFileStream.write(toPrint + "\n")
        else:
            toPrint = cells[0] + "," + cells[1]
            if len(cells) > 2:
                toPrint += " " + cells[2]
            print(toPrint)

    if printerFileStream != None:
        printerFileStream.close()


def createSearchList(searcher):
    """
    Creates a list of search-keys from the given parameter. If that paramater denotes a .DEFAULT_EXTENSION-file the values stored there will be collected.
    Otherwise the list contains only the given parameter.
    Will return the list created.
    
    Parameters
    ----------
    searcher: str
        the possible filename to be evaluated

    """
    result = []
    if re.match(r".+\." + DEFAULT_EXTENSION, searcher):
        f = open(searcher, "r", encoding='utf-8')
        for line in f:
            if not line.strip() == "":
                result.append(line.strip())
    else:
        result.append(searcher.strip())
    return result


def searchFiles(matching):
    result = []

    expanded = []
    for m in matching:
        if os.path.isdir(m):
            expanded.extend(
                os.path.join(m, f)
                for f in os.listdir(m)
                # nur Zulassungslisten, nicht z.B. check.csv/result.csv im selben Ordner
                if f.endswith("." + DEFAULT_EXTENSION) and DEFAULT_TEXT in f.lower()
            )
        else:
            expanded.append(m)

    matching = expanded

    result[:] = [p for p in matching if os.path.isfile(p)]
    matching[:] = [p for p in matching if not os.path.isfile(p)]

    if matching:
        for root, dirs, files in os.walk("."):
            for file in files:
                if any(re.match(matchString, file) for matchString in matching):
                    result.append(os.path.join(root, file))

    if not result:
        print("Warning: no files to collect data from were found")

    return result


def main(argv=None):
    if argv is None:
        argv = sys.argv
    else:
        sys.argv.extend(argv)
    # Setup argument parser
    parser = ArgumentParser(description=None, formatter_class=RawDescriptionHelpFormatter)
    parser.add_argument('--out', nargs=1, dest="target", required=False)
    parser.add_argument("--display", dest="display", choices=('yes', 'no'),
                        help="'yes' displays all students who DO have permission. 'no' does the contrary]")
    parser.add_argument("searchData",
                        help="A single search-string Name;Surname;{MatrNr} or a csv-file holding a data set. Will be treated as first part of a regular expression.")
    parser.add_argument("paths", help="A list of data files storing the permission data ", nargs=argparse.REMAINDER)

    # Process arguments
    args = parser.parse_args()

    # collect data
    paths = args.paths
    searchData = args.searchData
    display = args.display == "yes"
    target = args.target
    #if output file was denoted
    if target != None:
        target = target.pop(0)
    #setup list of search-values
    searchList = createSearchList(searchData)
    #for s in searchList:
       #print(s)

    #if no names where denoted search for default
    if len(paths) == 0:
        paths = searchFiles([r".*" + DEFAULT_TEXT + r".*\." + DEFAULT_EXTENSION])
    else:
        paths = searchFiles(paths)
    matchAgainstData(searchList, paths, display, target)


if __name__ == "__main__":
    main()